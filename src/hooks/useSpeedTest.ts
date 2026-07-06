import { useState, useCallback, useRef } from 'react';
import type {
  TestPhase, SpeedTestProgress, SpeedTestResult, Settings, DnsCheckResult,
  NetworkMetadata, TestProfile, LatencyStats,
} from '../types/speedtest';
import { initialProgress } from '../types/speedtest';
import { createProvider, resolveProviderPlan } from '../services/provider-factory';
import type { SpeedTestProvider as IProvider, StabilityMetric } from '../types/speedtest';
import { runDnsCheck } from '../services/dns-check';
import { measureLatency } from '../services/latency-engine';
import { fetchNetworkMetadata } from '../services/network-metadata';
import { coefficientOfVariation } from '../services/statistics';

/** Which provider (of how many) the run is currently measuring — drives the
 *  "current source · x/N" progress indicator. */
export interface ProviderStep {
  /** 1-based ordinal of the provider currently running. */
  index: number;
  /** Total providers this run's plan will visit. */
  count: number;
  /** Human-readable label of the current provider. */
  label: string;
}

export function useSpeedTest(settings: Settings, onComplete?: (result: SpeedTestResult) => void) {
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [progress, setProgress] = useState<SpeedTestProgress>(initialProgress());
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [dnsCheck, setDnsCheck] = useState<DnsCheckResult | null>(null);
  const [networkMetadata, setNetworkMetadata] = useState<NetworkMetadata | null>(null);
  const [providerStep, setProviderStep] = useState<ProviderStep | null>(null);
  const providerRef = useRef<IProvider | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Profile actually used for the last run, so RUN AGAIN / RETRY repeats it
  // rather than silently reverting to the stored default.
  const lastProfileRef = useRef<TestProfile>(settings.testProfile);

  const startTest = useCallback(async (profileOverride?: TestProfile) => {
    // FAST vs FULL: an explicit deck action wins; otherwise the stored default.
    const profile: TestProfile = profileOverride ?? settings.testProfile;
    lastProfileRef.current = profile;
    const consent = settings.dataPolicyAccepted;

    // Screen wake lock for the duration of the run: a phone screen locking
    // mid-test makes the browser throttle every transfer, poisoning all
    // readings (the orchestrator additionally detects and discloses hidden
    // runs). Best-effort — unsupported browsers just skip it.
    let wakeLock: { release(): Promise<void> } | null = null;
    const acquireWakeLock = async () => {
      try {
        const wl = (navigator as any).wakeLock;
        if (wl?.request) wakeLock = await wl.request('screen');
      } catch { /* denied or unsupported — fine */ }
    };
    const onVisibleReacquire = () => {
      // Wake locks auto-release when the page hides; re-acquire on return.
      if (!document.hidden && providerRef.current) void acquireWakeLock();
    };
    await acquireWakeLock();
    document.addEventListener('visibilitychange', onVisibleReacquire);
    const releaseWakeLock = () => {
      document.removeEventListener('visibilitychange', onVisibleReacquire);
      try { void wakeLock?.release(); } catch { /* already released */ }
      wakeLock = null;
    };

    // Consent gating: only the *explicit* single M-Lab modes are downgraded here.
    // The aggregated (`'both'`) path is handled gracefully by the plan resolver,
    // which drops NDT7/MSAK when consent is absent — no blanket downgrade.
    let effectiveMode = settings.providerMode;
    if ((effectiveMode === 'ndt7' || effectiveMode === 'msak') && !consent) {
      effectiveMode = 'cloudflare';
    }

    // How many providers this run will visit (for the x/N indicator).
    const planCount = effectiveMode === 'both'
      ? Math.max(1, resolveProviderPlan(profile, consent).length)
      : 1;

    setPhase('discovering');
    setResult(null);
    setDnsCheck(null);
    setNetworkMetadata(null);
    setProviderStep(null);
    setProgress({ ...initialProgress(), phase: 'discovering' });

    const provider = createProvider(effectiveMode, { profile, consent });
    providerRef.current = provider;
    const abortController = new AbortController();
    abortRef.current = abortController;

    // Fire DNS checks in background — don't block speed test
    const dnsPromise = runDnsCheck((partial) => setDnsCheck(partial))
      .catch((err) => {
        console.warn('[DNS Check] Failed:', err);
        return null;
      });

    // Fire network metadata fetch in background — resolves ~2-3s into test
    const metadataPromise = fetchNetworkMetadata(abortController.signal)
      .then((meta) => { setNetworkMetadata(meta); return meta; })
      .catch((err) => {
        console.warn('[Network Metadata] Failed:', err);
        return null;
      });

    // Derive the current provider ordinal from the progress stream. Each distinct
    // non-transition provider label the orchestrator emits advances the counter;
    // "Switching to …" transitions and the dedicated latency engine are skipped.
    let seenProviders = 0;
    let lastProviderLabel = '';
    const handleProviderProgress = (p: SpeedTestProgress) => {
      const label = p.currentProvider ?? '';
      const isTransition = label.toLowerCase().startsWith('switching');
      const isRealProvider = !!label && !isTransition && label !== 'Latency Engine';
      if (isRealProvider && label !== lastProviderLabel) {
        lastProviderLabel = label;
        seenProviders += 1;
        setProviderStep({ index: Math.min(seenProviders, planCount), count: planCount, label });
      }
      setPhase(p.phase);
      setProgress(p);
    };

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
        onSample: (stats) => {
          setProgress(prev => ({
            ...prev,
            phase: 'latency',
            currentProvider: 'Latency Engine',
            ping: stats.min,
            // Live PDV = P95 − P50 (the running-stats block has no pdv field yet).
            jitter: Math.max(0, stats.p95 - stats.p50),
          }));
        },
      });

      console.log('[Latency Engine] Complete:', {
        minRtt: latencyStats.minRttMs.toFixed(1),
        p50: latencyStats.p50.toFixed(1),
        p95: latencyStats.p95.toFixed(1),
        pdv: (latencyStats.pdv ?? 0).toFixed(2),
        samples: latencyStats.samples.length,
      });

      if (abortController.signal.aborted) throw new Error('Test stopped');

      // ── Phase: Provider bandwidth + loaded latency ────────────────
      const testResult = await provider.start(handleProviderProgress, settings.testDuration);

      // Wait for DNS checks and metadata to finish
      const dnsResult = await dnsPromise;
      const metadata = await metadataPromise;

      // Compute stability if bandwidth samples available (for single-provider modes)
      const bandwidthSamples = testResult.bandwidthSamples;
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

      // ── v4 latency reconciliation (METHODOLOGY.md §4) ──────────────
      // Headline ping = min-RTT: fold the dedicated engine's physical floor into
      // whatever the orchestrator already derived (engine + kernel MinRTTs).
      const foldedPing = Math.min(
        testResult.ping > 0 ? testResult.ping : Infinity,
        latencyStats.minRttMs > 0 ? latencyStats.minRttMs : Infinity,
      );
      const finalPing = Number.isFinite(foldedPing) ? foldedPing : testResult.ping;
      // Headline jitter = PDV. Prefer the v4 cross-provider blend's PDV; fall back
      // to the dedicated engine's idle PDV (single-provider modes have no blend).
      const finalJitter = testResult.latencyStats?.pdv ?? latencyStats.pdv;
      // Prefer the aggregate's blended latency block for the percentile ladder;
      // the dense idle engine (with PDV) is the single-provider fallback.
      const finalLatencyStats: LatencyStats = testResult.latencyStats ?? latencyStats;

      const resultWithExtras: SpeedTestResult = {
        ...testResult,
        ping: finalPing,
        jitter: finalJitter,
        latencyStats: finalLatencyStats,
        // Add stability if computed here (single-provider modes)
        ...(stability ? { stability } : {}),
        ...(dnsResult ? { dnsCheck: dnsResult } : {}),
        // Network metadata (IP, ISP, geolocation, edge server)
        ...(metadata ? { networkMetadata: metadata, isp: metadata.ispFull ?? undefined } : {}),
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
        navigator.clipboard?.writeText(formatResultSummary(resultWithExtras, dnsResult, metadata)).catch(() => {});
      }

      onComplete?.(resultWithExtras);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Test stopped') return; // User-initiated stop, not an error
      setPhase('error');
      setProgress(prev => ({ ...prev, phase: 'error', error: message }));
    } finally {
      releaseWakeLock();
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
    setProviderStep(null);
  }, []);

  const resetTest = useCallback(() => {
    setPhase('idle');
    setResult(null);
    setProgress(initialProgress());
    setDnsCheck(null);
    setNetworkMetadata(null);
    setProviderStep(null);
  }, []);

  /** Re-run using the profile from the most recent run (RUN AGAIN / RETRY). */
  const rerunTest = useCallback(() => startTest(lastProfileRef.current), [startTest]);
  // Read at render time (phase changes re-render consumers, so this is fresh
  // whenever the completion controls need it): which profile the last run used,
  // so the UI can offer the ALTERNATE mode as the secondary re-run.
  const lastProfile = lastProfileRef.current;

  return { phase, progress, result, dnsCheck, networkMetadata, providerStep, startTest, rerunTest, stopTest, resetTest, lastProfile };
}

// ── Clipboard summary (v4 payload) ───────────────────────────────────────────

function formatResultSummary(
  r: SpeedTestResult,
  dns: DnsCheckResult | null,
  metadata: NetworkMetadata | null,
): string {
  const lines: string[] = [];
  const ver = r.methodologyVersion ? ` (methodology ${r.methodologyVersion})` : '';
  lines.push(`SpeedQX Speed Test${ver}`);

  const dlCi = r.capacityMbps?.downloadCi ?? r.confidenceIntervals?.download;
  const ulCi = r.capacityMbps?.uploadCi ?? r.confidenceIntervals?.upload;
  let dl = `Download: ${r.downloadSpeed.toFixed(1)} Mbps`;
  if (dlCi) dl += ` (95% CI ${dlCi.lower.toFixed(1)}–${dlCi.upper.toFixed(1)})`;
  lines.push(dl);
  let ul = `Upload: ${r.uploadSpeed.toFixed(1)} Mbps`;
  if (ulCi) ul += ` (95% CI ${ulCi.lower.toFixed(1)}–${ulCi.upper.toFixed(1)})`;
  lines.push(ul);

  lines.push(`Ping: ${r.ping.toFixed(0)} ms (min-RTT) · Jitter: ${r.jitter.toFixed(1)} ms (PDV)`);

  if (r.consensusMbps) {
    let c = `Consensus: DL ${r.consensusMbps.download.toFixed(0)} / UL ${r.consensusMbps.upload.toFixed(0)} Mbps`;
    if (r.agreement) {
      const band = r.agreement.band.replace('-', ' ');
      const i2 = r.agreement.i2 != null ? ` (I² ${(r.agreement.i2 * 100).toFixed(0)}%)` : '';
      c += ` · Agreement: ${band}${i2}`;
    }
    lines.push(c);
  }

  if (typeof r.rpm === 'number' && r.rpm > 0) lines.push(`Responsiveness: ${r.rpm.toFixed(0)} RPM`);

  if (r.bufferbloat) {
    const delta = r.bufferbloat.deltaMs;
    const d = typeof delta === 'number' ? ` (+${delta.toFixed(0)} ms)` : '';
    lines.push(`Bufferbloat: Grade ${r.bufferbloat.grade}${d}`);
  }

  if (r.stability) {
    lines.push(`Stability: DL CV ${(r.stability.downloadCV * 100).toFixed(0)}% · UL CV ${(r.stability.uploadCV * 100).toFixed(0)}%`);
  }

  if (r.packetLoss != null) lines.push(`Packet loss: ${r.packetLoss.toFixed(1)}%`);

  const ran = r.providers?.filter((p) => p.availability === 'ran').map((p) => p.name);
  if (ran && ran.length > 0) lines.push(`Sources: ${ran.join(', ')}`);

  if (dns) {
    lines.push('', 'Connectivity Diagnostics:');
    for (const probe of dns.probes) {
      let probeStr = `${probe.domain}: ${probe.status === 'pass' ? `${probe.totalMs}ms` : 'FAIL'}`;
      if (probe.dnsMs !== null) probeStr += ` (DNS: ${probe.dnsMs}ms)`;
      lines.push(probeStr);
    }
    const passed = dns.probes.filter((p) => p.status === 'pass');
    let summary = `${passed.length}/${dns.probes.length} passed`;
    if (dns.avgTotalMs !== null) summary += ` • avg ${dns.avgTotalMs}ms`;
    lines.push(summary);
  }

  if (metadata) {
    lines.push('', 'Network Info:');
    if (metadata.ispFull) lines.push(`ISP: ${metadata.ispFull}`);
    if (metadata.ip) lines.push(`IP: ${metadata.ip} (IPv${metadata.ipVersion ?? '?'})`);
    const location = [metadata.city, metadata.region, metadata.country].filter(Boolean).join(', ');
    if (location) lines.push(`Location: ${location}`);
    if (metadata.coloCity) lines.push(`Edge: ${metadata.coloCity} (${metadata.colo})`);
  }

  return lines.join('\n');
}
