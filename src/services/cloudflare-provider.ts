import SpeedTestEngine from '@cloudflare/speedtest';
import type { SpeedTestProvider, SpeedTestProgress, SpeedTestResult, TestDuration, LatencyStats, BufferbloatResult, BufferbloatGrade, AimScores } from '../types/speedtest';
import { computeLatencyStats } from './statistics';

function buildMeasurements(duration: TestDuration) {
  // Default measurements for 'auto'
  const defaults = [
    { type: 'latency' as const, numPackets: 20 },
    { type: 'download' as const, bytes: 1e5, count: 1, bypassMinDuration: true },
    { type: 'download' as const, bytes: 1e5, count: 8 },
    { type: 'download' as const, bytes: 1e6, count: 6 },
    { type: 'download' as const, bytes: 1e7, count: 4 },
    { type: 'upload' as const, bytes: 1e5, count: 8 },
    { type: 'upload' as const, bytes: 1e6, count: 6 },
    { type: 'upload' as const, bytes: 1e7, count: 4 },
    { type: 'download' as const, bytes: 1e8, count: 3 },
    { type: 'download' as const, bytes: 2.5e8, count: 2 },
    { type: 'upload' as const, bytes: 5e7, count: 3 },
    { type: 'packetLoss' as const, numPackets: 1000 },
  ];

  if (duration === 'auto') return defaults;

  // Scale measurements to fill requested duration
  const seconds = typeof duration === 'number' ? duration : 30;
  const factor = Math.max(1, Math.round(seconds / 30));

  return [
    { type: 'latency' as const, numPackets: 20 * factor },
    { type: 'download' as const, bytes: 1e5, count: 1, bypassMinDuration: true },
    { type: 'download' as const, bytes: 1e5, count: 8 * factor },
    { type: 'download' as const, bytes: 1e6, count: 6 * factor },
    { type: 'download' as const, bytes: 1e7, count: 4 * factor },
    { type: 'upload' as const, bytes: 1e5, count: 8 * factor },
    { type: 'upload' as const, bytes: 1e6, count: 6 * factor },
    { type: 'upload' as const, bytes: 1e7, count: 4 * factor },
    { type: 'download' as const, bytes: 1e8, count: 3 * factor },
    { type: 'download' as const, bytes: 2.5e8, count: 2 * factor },
    { type: 'upload' as const, bytes: 5e7, count: 3 * factor },
    { type: 'packetLoss' as const, numPackets: 1000 },
  ];
}

export class CloudflareProvider implements SpeedTestProvider {
  name = 'Cloudflare';
  supportsPacketLoss = true;
  requiresConsent = false;

  private engine: SpeedTestEngine | null = null;

  start(onProgress: (p: SpeedTestProgress) => void, duration: TestDuration = 'auto'): Promise<SpeedTestResult> {
    return new Promise((resolve, reject) => {
      const measurements = buildMeasurements(duration);

      // Build flattened byte-size arrays so progress is weighted by data volume,
      // not chunk count. A 250MB chunk should move the bar ~2500x more than 100KB.
      const dlByteSizes: number[] = [];
      const ulByteSizes: number[] = [];
      for (const m of measurements) {
        if (m.type === 'download' && 'bytes' in m && 'count' in m) {
          for (let i = 0; i < m.count; i++) dlByteSizes.push(m.bytes);
        } else if (m.type === 'upload' && 'bytes' in m && 'count' in m) {
          for (let i = 0; i < m.count; i++) ulByteSizes.push(m.bytes);
        }
      }
      const totalDlBytes = dlByteSizes.reduce((s, b) => s + b, 0);
      const totalUlBytes = ulByteSizes.reduce((s, b) => s + b, 0);
      let dlCount = 0;
      let ulCount = 0;
      let dlBytesTransferred = 0;
      let ulBytesTransferred = 0;
      let currentPhase = 'discovering';

      // Track last known good values from progress callbacks as fallback
      let lastPing: number | null = null;
      let lastJitter: number | null = null;
      let lastDlMbps: number | null = null;
      let lastUlMbps: number | null = null;
      let lastPacketLoss: number | null = null;

      let settled = false;

      this.engine = new SpeedTestEngine({
        autoStart: false,
        measurements,
        bandwidthPercentile: 0.5,
        latencyPercentile: 0.5,
        bandwidthMinRequestDuration: 50,
        loadedLatencyThrottle: 200,
        loadedLatencyMaxPoints: 50,
        measureDownloadLoadedLatency: true,
        measureUploadLoadedLatency: true,
      });

      const engine = this.engine;

      engine.onResultsChange = ({ type }: { type: string }) => {
        const results = engine.results;

        if (type === 'latency') {
          currentPhase = 'latency';
        } else if (type === 'download') {
          currentPhase = 'download';
          if (dlCount < dlByteSizes.length) {
            dlBytesTransferred += dlByteSizes[dlCount];
          }
          dlCount++;
        } else if (type === 'upload') {
          currentPhase = 'upload';
          if (ulCount < ulByteSizes.length) {
            ulBytesTransferred += ulByteSizes[ulCount];
          }
          ulCount++;
        }

        const ping = results.getUnloadedLatency();
        const jitter = results.getUnloadedJitter();
        const dlBps = results.getDownloadBandwidth();
        const ulBps = results.getUploadBandwidth();
        const packetLoss = results.getPacketLoss();

        // Capture last known good values for fallback in onFinish
        if (ping !== undefined) lastPing = ping;
        if (jitter !== undefined) lastJitter = jitter;
        if (dlBps !== undefined) lastDlMbps = dlBps / 1e6;
        if (ulBps !== undefined) lastUlMbps = ulBps / 1e6;
        if (packetLoss !== undefined) lastPacketLoss = packetLoss;

        onProgress({
          phase: currentPhase as SpeedTestProgress['phase'],
          currentProvider: 'Cloudflare',
          ping: ping ?? null,
          jitter: jitter ?? null,
          downloadSpeed: dlBps !== undefined ? dlBps / 1e6 : null,
          uploadSpeed: ulBps !== undefined ? ulBps / 1e6 : null,
          packetLoss: packetLoss ?? null,
          downloadProgress: totalDlBytes > 0 ? (dlBytesTransferred / totalDlBytes) * 100 : 0,
          uploadProgress: totalUlBytes > 0 ? (ulBytesTransferred / totalUlBytes) * 100 : 0,
          serverName: 'Cloudflare Edge',
          error: null,
        });
      };

      engine.onFinish = (results) => {
        settled = true;
        const summary = results.getSummary();
        console.log('[Cloudflare] Summary:', summary);
        const summaryDl = summary.download ?? 0;
        const summaryUl = summary.upload ?? 0;
        const dlMbps = summaryDl > 0 ? summaryDl / 1e6 : (lastDlMbps ?? 0);
        const ulMbps = summaryUl > 0 ? summaryUl / 1e6 : (lastUlMbps ?? 0);

        // Collect loaded latency data for bufferbloat detection
        const unloadedLatencyPoints = results.getUnloadedLatencyPoints?.() ?? [];
        const dlLoadedLatencyPoints = results.getDownLoadedLatencyPoints?.() ?? [];
        const ulLoadedLatencyPoints = results.getUpLoadedLatencyPoints?.() ?? [];
        const dlLoadedLatency = results.getDownLoadedLatency?.() ?? null;
        const ulLoadedLatency = results.getUpLoadedLatency?.() ?? null;
        const dlLoadedJitter = results.getDownLoadedJitter?.() ?? null;
        const ulLoadedJitter = results.getUpLoadedJitter?.() ?? null;

        // Build latency stats from unloaded points
        const latencyStats = unloadedLatencyPoints.length > 0
          ? computeLatencyStats(unloadedLatencyPoints)
          : undefined;

        // Build bufferbloat result
        let bufferbloat: BufferbloatResult | undefined;
        const unloadedLat = summary.latency ?? lastPing ?? 0;
        if (unloadedLat > 0 && (dlLoadedLatency || ulLoadedLatency)) {
          const dlRatio = dlLoadedLatency && dlLoadedLatency > 0 ? dlLoadedLatency / unloadedLat : 1;
          const ulRatio = ulLoadedLatency && ulLoadedLatency > 0 ? ulLoadedLatency / unloadedLat : 1;
          const maxRatio = Math.max(dlRatio, ulRatio);
          let grade: BufferbloatGrade = 'A';
          if (maxRatio >= 10) grade = 'F';
          else if (maxRatio >= 5) grade = 'D';
          else if (maxRatio >= 3) grade = 'C';
          else if (maxRatio >= 1.5) grade = 'B';

          bufferbloat = {
            unloadedLatency: latencyStats ?? computeLatencyStats(unloadedLat > 0 ? [unloadedLat] : []),
            downloadLoadedLatency: computeLatencyStats(dlLoadedLatencyPoints),
            uploadLoadedLatency: computeLatencyStats(ulLoadedLatencyPoints),
            grade,
            downloadRatio: dlRatio,
            uploadRatio: ulRatio,
          };
        }

        // Collect raw bandwidth samples
        const dlBandwidthPoints = results.getDownloadBandwidthPoints?.() ?? [];
        const ulBandwidthPoints = results.getUploadBandwidthPoints?.() ?? [];
        const dlSamples = dlBandwidthPoints.map((p: any) => p.bps / 1e6); // Convert to Mbps
        const ulSamples = ulBandwidthPoints.map((p: any) => p.bps / 1e6);

        // Extract AIM scores (streaming, gaming, rtc quality ratings)
        let aimScores: AimScores | undefined;
        try {
          const scores = results.getScores?.();
          if (scores && Object.keys(scores).length > 0) {
            aimScores = scores as AimScores;
          }
        } catch {
          // AIM scores unavailable (e.g. incomplete test)
        }

        resolve({
          provider: 'cloudflare',
          ping: summary.latency ?? lastPing ?? 0,
          jitter: summary.jitter ?? lastJitter ?? 0,
          downloadSpeed: dlMbps,
          uploadSpeed: ulMbps,
          packetLoss: summary.packetLoss ?? lastPacketLoss ?? null,
          serverName: 'Cloudflare Edge',
          timestamp: Date.now(),
          latencyStats,
          bufferbloat,
          aimScores,
          bandwidthSamples: { download: dlSamples, upload: ulSamples },
        } as any);
      };

      engine.onError = (error: string) => {
        console.warn('[Cloudflare] Error:', error);
        // Don't reject immediately — CF fires onError for non-fatal phase
        // errors (e.g. TURN credential failure during packet loss) but still
        // calls onFinish with valid download/upload/latency data. Defer
        // rejection to give onFinish a chance to resolve first.
        setTimeout(() => {
          if (!settled) {
            reject(new Error(error));
          }
        }, 2000);
      };

      onProgress({
        phase: 'discovering',
        currentProvider: 'Cloudflare',
        ping: null,
        jitter: null,
        downloadSpeed: null,
        uploadSpeed: null,
        packetLoss: null,
        downloadProgress: 0,
        uploadProgress: 0,
        serverName: 'Cloudflare Edge',
        error: null,
      });

      engine.play();
    });
  }

  stop() {
    if (this.engine) {
      this.engine.pause();
      this.engine = null;
    }
  }
}
