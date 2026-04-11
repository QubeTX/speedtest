import type {
  SpeedTestProvider,
  SpeedTestProgress,
  SpeedTestResult,
  TestDuration,
  BufferbloatResult,
  StabilityMetric,
  BandwidthEstimate,
  JitterBreakdown,
} from '../types/speedtest';
import { CloudflareProvider } from './cloudflare-provider';
import { NDT7Provider } from './ndt7-provider';
import {
  weightedMerge,
  accurateBandwidth,
  accurateUploadBandwidth,
  coefficientOfVariation,
  computeLatencyStats,
  variance,
  inverseVarianceMerge,
  bootstrapCI,
} from './statistics';

// Latency weights remain fixed: NDT7's MinRTT is structurally different/better,
// not just lower-variance, so inverse-variance weighting isn't appropriate here.
const CF_LATENCY_WEIGHT = 0.4;

/** Divergence threshold: if providers differ by more than this fraction, flag it. */
const DIVERGENCE_THRESHOLD = 0.3;

function divergenceRatio(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  return Math.abs(a - b) / Math.max(a, b);
}

export class AggregatedProvider implements SpeedTestProvider {
  name = 'Both (Aggregated)';
  supportsPacketLoss = true;
  requiresConsent = true; // NDT7 requires consent

  private cf = new CloudflareProvider();
  private ndt = new NDT7Provider();
  private stopped = false;

  async start(onProgress: (p: SpeedTestProgress) => void, duration: TestDuration = 'auto'): Promise<SpeedTestResult> {
    this.stopped = false;

    // Each provider gets the FULL requested duration — accuracy > speed.
    const providerDuration: TestDuration = duration;

    // ── Phase 1: Cloudflare (progress 0-100%) ─────────────────────
    // Each provider's bars go 0-100% independently. The phase label
    // ("VIA CLOUDFLARE" / "VIA M-LAB NDT7") shows which is running.
    let cfResult: SpeedTestResult;
    try {
      cfResult = await this.cf.start((p) => {
        if (this.stopped) return;
        onProgress({
          ...p,
          currentProvider: 'Cloudflare',
        });
      }, providerDuration);
    } catch (err) {
      console.warn('[Aggregated] Cloudflare failed:', err);
      cfResult = {
        provider: 'cloudflare',
        ping: 0,
        jitter: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        packetLoss: null,
        serverName: 'Cloudflare Edge',
        timestamp: Date.now(),
      };
    }

    console.log('[Aggregated] Cloudflare result:', {
      dl: cfResult.downloadSpeed,
      ul: cfResult.uploadSpeed,
      ping: cfResult.ping,
      jitter: cfResult.jitter,
      bufferbloat: (cfResult as any).bufferbloat?.grade,
    });

    // Release CF connections before NDT7 starts
    this.cf.stop();

    if (this.stopped) throw new Error('Test stopped');

    // 3-second transition between providers
    onProgress({
      phase: 'discovering',
      currentProvider: 'Switching to M-Lab NDT7',
      ping: cfResult.ping,
      jitter: cfResult.jitter,
      downloadSpeed: null,
      uploadSpeed: null,
      packetLoss: cfResult.packetLoss,
      downloadProgress: 100,
      uploadProgress: 100,
      serverName: cfResult.serverName,
      error: null,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    if (this.stopped) throw new Error('Test stopped');

    // ── Phase 2: NDT7 (progress 0-100%) ─────────────────────────────
    let ndtResult: SpeedTestResult;
    try {
      ndtResult = await this.ndt.start((p) => {
        if (this.stopped) return;
        onProgress({
          ...p,
          currentProvider: 'M-Lab NDT7',
          ping: p.ping ?? cfResult.ping,
          jitter: p.jitter ?? cfResult.jitter,
        });
      }, providerDuration);
    } catch (err) {
      console.warn('[Aggregated] NDT7 failed:', err);
      ndtResult = {
        provider: 'ndt7',
        ping: 0,
        jitter: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        packetLoss: null,
        serverName: 'M-Lab Server',
        timestamp: Date.now(),
      };
    }

    console.log('[Aggregated] NDT7 result:', {
      dl: ndtResult.downloadSpeed,
      ul: ndtResult.uploadSpeed,
      ping: ndtResult.ping,
      jitter: ndtResult.jitter,
    });

    // ── Aggregate with accuracy pipeline ────────────────────────────

    // Extract raw bandwidth samples from both providers
    const cfSamples = (cfResult as any).bandwidthSamples as { download: number[]; upload: number[] } | undefined;
    const ndtSamples = (ndtResult as any).bandwidthSamples as { download: number[]; upload: number[] } | undefined;

    // Apply full accuracy pipeline (slow-start discard + outlier filter + trimean)
    // to raw samples when available, otherwise fall back to provider-reported values
    const cfDlAccurate = cfSamples?.download?.length ? accurateBandwidth(cfSamples.download) : cfResult.downloadSpeed;
    const cfUlAccurate = cfSamples?.upload?.length ? accurateUploadBandwidth(cfSamples.upload) : cfResult.uploadSpeed;
    const ndtDlAccurate = ndtSamples?.download?.length ? accurateBandwidth(ndtSamples.download) : ndtResult.downloadSpeed;
    const ndtUlAccurate = ndtSamples?.upload?.length ? accurateUploadBandwidth(ndtSamples.upload) : ndtResult.uploadSpeed;

    // Inverse-variance weighted bandwidth merge — statistically optimal combination.
    // Weights adapt to actual measurement consistency instead of being hardcoded.
    const cfDlVar = variance(cfSamples?.download ?? []);
    const ndtDlVar = variance(ndtSamples?.download ?? []);
    const dlMerge = inverseVarianceMerge(cfDlAccurate, cfDlVar, ndtDlAccurate, ndtDlVar);
    const avgDl = dlMerge.value;

    const cfUlVar = variance(cfSamples?.upload ?? []);
    const ndtUlVar = variance(ndtSamples?.upload ?? []);
    const ulMerge = inverseVarianceMerge(cfUlAccurate, cfUlVar, ndtUlAccurate, ndtUlVar);
    const avgUl = ulMerge.value;

    console.log('[Aggregated] Dynamic weights:', {
      downloadCF: dlMerge.weightA.toFixed(2), downloadNDT: dlMerge.weightB.toFixed(2),
      uploadCF: ulMerge.weightA.toFixed(2), uploadNDT: ulMerge.weightB.toFixed(2),
    });

    // Confidence-weighted latency merge (NDT7 weighted higher — structural advantage from kernel MinRTT)
    const avgPing = weightedMerge(cfResult.ping, ndtResult.ping, CF_LATENCY_WEIGHT);
    const avgJitter = weightedMerge(cfResult.jitter, ndtResult.jitter, CF_LATENCY_WEIGHT);

    // Divergence detection
    const dlDivergence = divergenceRatio(cfDlAccurate, ndtDlAccurate);
    const ulDivergence = divergenceRatio(cfUlAccurate, ndtUlAccurate);
    const significant = dlDivergence > DIVERGENCE_THRESHOLD || ulDivergence > DIVERGENCE_THRESHOLD;

    if (significant) {
      console.warn('[Aggregated] Significant provider divergence detected:', {
        download: `CF=${cfDlAccurate.toFixed(1)} vs NDT=${ndtDlAccurate.toFixed(1)} (${(dlDivergence * 100).toFixed(0)}%)`,
        upload: `CF=${cfUlAccurate.toFixed(1)} vs NDT=${ndtUlAccurate.toFixed(1)} (${(ulDivergence * 100).toFixed(0)}%)`,
      });
    }

    // Merge latency stats — prefer Cloudflare's (more samples from loaded latency probing)
    const cfLatencyStats = (cfResult as any).latencyStats;
    const ndtLatencyStats = (ndtResult as any).latencyStats;
    const mergedLatencyStats = cfLatencyStats ?? ndtLatencyStats;

    // Bufferbloat — use Cloudflare's (it measures loaded latency natively)
    const bufferbloat: BufferbloatResult | undefined = (cfResult as any).bufferbloat;

    // AIM scores — use Cloudflare's (only CF provides these)
    const aimScores = (cfResult as any).aimScores;

    // Connection stability — compute from combined raw samples
    const allDlSamples = [...(cfSamples?.download ?? []), ...(ndtSamples?.download ?? [])];
    const allUlSamples = [...(cfSamples?.upload ?? []), ...(ndtSamples?.upload ?? [])];
    const stability: StabilityMetric | undefined = (allDlSamples.length > 2 || allUlSamples.length > 2)
      ? {
          downloadCV: coefficientOfVariation(allDlSamples),
          uploadCV: coefficientOfVariation(allUlSamples),
          downloadStable: coefficientOfVariation(allDlSamples) < 0.15,
          uploadStable: coefficientOfVariation(allUlSamples) < 0.15,
        }
      : undefined;

    // Jitter breakdown — use Cloudflare's (only CF has loaded latency probes)
    const jitterBreakdown: JitterBreakdown | undefined = (cfResult as any).jitterBreakdown;

    // Bootstrap confidence intervals on combined samples
    let downloadEstimate: BandwidthEstimate | undefined;
    let uploadEstimate: BandwidthEstimate | undefined;
    if (allDlSamples.length >= 4) {
      const dlCI = bootstrapCI(allDlSamples);
      downloadEstimate = {
        value: avgDl,
        ci95Lower: dlCI.lower,
        ci95Upper: dlCI.upper,
        ciMargin: dlCI.margin,
        method: 'inverse-variance + trimean',
        sampleCount: allDlSamples.length,
      };
    }
    if (allUlSamples.length >= 4) {
      const ulCI = bootstrapCI(allUlSamples);
      uploadEstimate = {
        value: avgUl,
        ci95Lower: ulCI.lower,
        ci95Upper: ulCI.upper,
        ciMargin: ulCI.margin,
        method: 'inverse-variance + trimean',
        sampleCount: allUlSamples.length,
      };
    }

    return {
      provider: 'aggregated',
      ping: avgPing,
      jitter: avgJitter,
      downloadSpeed: avgDl,
      uploadSpeed: avgUl,
      packetLoss: cfResult.packetLoss,
      serverName: `CF Edge + ${ndtResult.serverName}`,
      timestamp: Date.now(),
      latencyStats: mergedLatencyStats,
      bufferbloat,
      stability,
      aimScores,
      jitterBreakdown,
      downloadEstimate,
      uploadEstimate,
      providerDivergence: {
        download: dlDivergence,
        upload: ulDivergence,
        significant,
      },
      providerResults: {
        cloudflare: cfResult,
        ndt7: ndtResult,
      },
    };
  }

  stop() {
    this.stopped = true;
    this.cf.stop();
    this.ndt.stop();
  }
}
