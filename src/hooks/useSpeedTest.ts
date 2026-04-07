import { useState, useCallback, useRef } from 'react';
import type { TestPhase, SpeedTestProgress, SpeedTestResult, Settings, DnsCheckResult } from '../types/speedtest';
import { initialProgress } from '../types/speedtest';
import { createProvider } from '../services/provider-factory';
import type { SpeedTestProvider as IProvider, StabilityMetric } from '../types/speedtest';
import { runDnsCheck } from '../services/dns-check';
import { measureLatency } from '../services/latency-engine';
import { coefficientOfVariation } from '../services/statistics';

export function useSpeedTest(settings: Settings, onComplete?: (result: SpeedTestResult) => void) {
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [progress, setProgress] = useState<SpeedTestProgress>(initialProgress());
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [dnsCheck, setDnsCheck] = useState<DnsCheckResult | null>(null);
  const providerRef = useRef<IProvider | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startTest = useCallback(async () => {
    // If NDT7 consent not given, fall back to cloudflare-only
    const effectiveMode = (settings.providerMode === 'ndt7' || settings.providerMode === 'both') && !settings.dataPolicyAccepted
      ? 'cloudflare'
      : settings.providerMode;

    setPhase('discovering');
    setResult(null);
    setDnsCheck(null);
    setProgress({ ...initialProgress(), phase: 'discovering' });

    const provider = createProvider(effectiveMode);
    providerRef.current = provider;
    const abortController = new AbortController();
    abortRef.current = abortController;

    // Fire DNS checks in background — don't block speed test
    const dnsPromise = runDnsCheck((partial) => setDnsCheck(partial))
      .catch((err) => {
        console.warn('[DNS Check] Failed:', err);
        return null;
      });

    try {
      // ── Phase: Dedicated latency measurement ──────────────────────
      setPhase('latency');
      setProgress(prev => ({ ...prev, phase: 'latency', currentProvider: 'Latency Engine' }));

      // Scale latency samples with test duration:
      // 15s → 50 samples, 30s → 100, 60s → 150, 120s+ → 200, auto → 100
      const durationSeconds = settings.testDuration === 'auto' ? 30
        : typeof settings.testDuration === 'number' ? settings.testDuration : 30;
      const latencySamples = Math.min(200, Math.max(50, Math.round(durationSeconds * 3.3)));

      const latencyStats = await measureLatency({
        sampleCount: latencySamples,
        intervalMs: 50,
        signal: abortController.signal,
        onSample: (stats, idx) => {
          setProgress(prev => ({
            ...prev,
            phase: 'latency',
            currentProvider: 'Latency Engine',
            ping: stats.p50,
            jitter: stats.jitter,
          }));
        },
      });

      console.log('[Latency Engine] Complete:', {
        p50: latencyStats.p50.toFixed(1),
        p95: latencyStats.p95.toFixed(1),
        p99: latencyStats.p99.toFixed(1),
        jitter: latencyStats.jitter.toFixed(2),
        samples: latencyStats.samples.length,
      });

      if (abortController.signal.aborted) throw new Error('Test stopped');

      // ── Phase: Provider bandwidth + loaded latency ────────────────
      const testResult = await provider.start((p) => {
        setPhase(p.phase);
        setProgress(p);
      }, settings.testDuration);

      // Wait for DNS checks to finish
      const dnsResult = await dnsPromise;

      // Compute stability if bandwidth samples available (for single-provider modes)
      const bandwidthSamples = (testResult as any).bandwidthSamples as { download: number[]; upload: number[] } | undefined;
      let stability: StabilityMetric | undefined = testResult.stability;
      if (!stability && bandwidthSamples) {
        const dlSamples = bandwidthSamples.download ?? [];
        const ulSamples = bandwidthSamples.upload ?? [];
        if (dlSamples.length > 2 || ulSamples.length > 2) {
          const dlCV = coefficientOfVariation(dlSamples);
          const ulCV = coefficientOfVariation(ulSamples);
          stability = {
            downloadCV: dlCV,
            uploadCV: ulCV,
            downloadStable: dlCV < 0.15,
            uploadStable: ulCV < 0.15,
          };
        }
      }

      // Merge independent latency engine results with provider results
      const resultWithExtras: SpeedTestResult = {
        ...testResult,
        // Prefer dedicated latency engine stats (100 samples, precise timing)
        // over provider-reported latency (fewer samples, less control)
        latencyStats: latencyStats,
        // Add stability if computed here (single-provider modes)
        ...(stability ? { stability } : {}),
        // Keep provider's ping/jitter for the headline numbers but
        // latencyStats provides the full percentile breakdown
        ...(dnsResult ? { dnsCheck: dnsResult } : {}),
      };

      setPhase('complete');
      setResult(resultWithExtras);
      setProgress(prev => ({
        ...prev,
        phase: 'complete',
        downloadProgress: 100,
        uploadProgress: 100,
      }));

      // Copy to clipboard if enabled
      if (settings.autoCopyResults) {
        let summary = `Speed Test Results\nDownload: ${testResult.downloadSpeed.toFixed(1)} Mbps\nUpload: ${testResult.uploadSpeed.toFixed(1)} Mbps\nPing: ${testResult.ping.toFixed(0)} ms (P50: ${latencyStats.p50.toFixed(0)}, P95: ${latencyStats.p95.toFixed(0)}, P99: ${latencyStats.p99.toFixed(0)})\nJitter: ${latencyStats.jitter.toFixed(1)} ms (RFC 3550)`;

        if (resultWithExtras.bufferbloat) {
          summary += `\nBufferbloat: Grade ${resultWithExtras.bufferbloat.grade} (DL ${resultWithExtras.bufferbloat.downloadRatio.toFixed(1)}x / UL ${resultWithExtras.bufferbloat.uploadRatio.toFixed(1)}x)`;
        }

        if (resultWithExtras.stability) {
          summary += `\nStability: DL CV=${(resultWithExtras.stability.downloadCV * 100).toFixed(0)}% UL CV=${(resultWithExtras.stability.uploadCV * 100).toFixed(0)}%`;
        }

        if (resultWithExtras.providerDivergence?.significant) {
          summary += `\n⚠ Provider divergence: DL ${(resultWithExtras.providerDivergence.download * 100).toFixed(0)}% UL ${(resultWithExtras.providerDivergence.upload * 100).toFixed(0)}%`;
        }

        if (dnsResult) {
          summary += `\n\nConnectivity Diagnostics:`;
          for (const probe of dnsResult.probes) {
            let probeStr = `\n${probe.domain}: ${probe.status === 'pass' ? `${probe.totalMs}ms` : 'FAIL'}`;
            if (probe.dnsMs !== null) probeStr += ` (DNS: ${probe.dnsMs}ms)`;
            summary += probeStr;
          }
          const passed = dnsResult.probes.filter(p => p.status === 'pass');
          summary += `\n${passed.length}/${dnsResult.probes.length} passed`;
          if (dnsResult.avgTotalMs !== null) {
            summary += ` • avg ${dnsResult.avgTotalMs}ms`;
          }
        }

        navigator.clipboard?.writeText(summary).catch(() => {});
      }

      onComplete?.(resultWithExtras);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Test stopped') return; // User-initiated stop, not an error
      setPhase('error');
      setProgress(prev => ({ ...prev, phase: 'error', error: message }));
    } finally {
      providerRef.current = null;
      abortRef.current = null;
    }
  }, [settings, onComplete]);

  const stopTest = useCallback(() => {
    abortRef.current?.abort();
    providerRef.current?.stop();
    providerRef.current = null;
    abortRef.current = null;
    setPhase('idle');
    setProgress(initialProgress());
    setDnsCheck(null);
  }, []);

  const resetTest = useCallback(() => {
    setPhase('idle');
    setResult(null);
    setProgress(initialProgress());
    setDnsCheck(null);
  }, []);

  return { phase, progress, result, dnsCheck, startTest, stopTest, resetTest };
}
