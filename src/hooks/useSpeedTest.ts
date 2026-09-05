import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  TestPhase, SpeedTestProgress, SpeedTestResult, Settings, DnsCheckResult,
  NetworkMetadata, TestProfile,
} from '../types/speedtest';
import { initialProgress } from '../types/speedtest';
import { createProvider } from '../services/provider-factory';
import type { SpeedTestProvider as IProvider, StabilityMetric } from '../types/speedtest';
import { runDnsCheck } from '../services/dns-check';
import { fetchNetworkMetadata } from '../services/network-metadata';
import { coefficientOfVariation } from '../services/statistics';
import { formatV5Result } from '../services/result-v5-text';

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
  const runRef = useRef(0);
  const runningRef = useRef(false);
  useEffect(() => () => { runRef.current++; runningRef.current = false; providerRef.current?.stop(); abortRef.current?.abort(); }, []);

  // Auxiliary diagnostics run only after a completed measurement. Their HTTP
  // requests must not load the idle reference or survive a new run/unmount.
  const completedTimestamp = phase === 'complete' && result?.measurement?.stopReason === 'complete' ? result.timestamp : null;
  useEffect(() => {
    if (completedTimestamp === null) return;
    const owner = new AbortController();
    void Promise.all([runDnsCheck(undefined, owner.signal), fetchNetworkMetadata(owner.signal)])
      .then(([dns, metadata]) => {
        if (owner.signal.aborted) return;
        setDnsCheck(dns); setNetworkMetadata(metadata);
        setResult(current => current?.timestamp === completedTimestamp ? { ...current, dnsCheck: dns, ...(metadata ? { networkMetadata: metadata, isp: metadata.ispFull ?? undefined } : {}) } : current);
      }).catch(() => {});
    return () => owner.abort();
  }, [completedTimestamp]);

  const startTest = useCallback(async (profileOverride?: TestProfile) => {
    if (runningRef.current) return;
    runningRef.current = true;
    const run = ++runRef.current;
    const current = () => runRef.current === run;
    // FAST vs FULL: an explicit deck action wins; otherwise the stored default.
    const profile: TestProfile = profileOverride ?? settings.testProfile;
    lastProfileRef.current = profile;
    const consent = settings.dataPolicyAccepted;

    // Screen wake lock for the duration of the run: a phone screen locking
    // mid-test makes the browser throttle every transfer, poisoning all
    // readings (the orchestrator additionally detects and discloses hidden
    // runs). Best-effort — unsupported browsers just skip it.
    let wakeLock: { release(): Promise<void> } | null = null;
    let wakeLockFinished = false;
    const acquireWakeLock = async () => {
      try {
        const wl = (navigator as any).wakeLock;
        if (wl?.request) {
          const acquired = await wl.request('screen');
          if (wakeLockFinished || !current()) await acquired.release();
          else { void wakeLock?.release().catch(() => {}); wakeLock = acquired; }
        }
      } catch { /* denied or unsupported — fine */ }
    };
    const onVisibleReacquire = () => {
      // Wake locks auto-release when the page hides; re-acquire on return.
      if (!document.hidden && providerRef.current) void acquireWakeLock();
    };
    void acquireWakeLock();
    document.addEventListener('visibilitychange', onVisibleReacquire);
    const releaseWakeLock = () => {
      wakeLockFinished = true;
      document.removeEventListener('visibilitychange', onVisibleReacquire);
      try { void wakeLock?.release().catch(() => {}); } catch { /* already released */ }
      wakeLock = null;
    };

    const effectiveMode = 'both';
    const planCount = (profile === 'full' ? 2 : 1) * (consent ? 2 : 1) + (consent ? 1 : 0) + (profile === 'full' ? 4 : 0);

    setPhase('discovering');
    setResult(null);
    setDnsCheck(null);
    setNetworkMetadata(null);
    setProviderStep(null);
    setProgress({ ...initialProgress(), phase: 'discovering' });

    const provider = createProvider(effectiveMode, { profile, consent, maxBytes: settings.maxBytes });
    providerRef.current = provider;
    const abortController = new AbortController();
    abortRef.current = abortController;

    // Derive the current provider ordinal from the progress stream. Each distinct
    // non-transition provider label the orchestrator emits advances the counter;
    // "Switching to …" transitions and the dedicated latency engine are skipped.
    let seenProviders = 0;
    let lastProviderLabel = '';
    const handleProviderProgress = (p: SpeedTestProgress) => {
      if (!current()) return;
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
      // ── Phase: Provider bandwidth + loaded latency ────────────────
      const testResult = await provider.start(handleProviderProgress, settings.testDuration);

      if (!current()) return;
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

      const resultWithExtras: SpeedTestResult = {
        ...testResult,
        // Add stability if computed here (single-provider modes)
        ...(stability ? { stability } : {}),
      };

      setPhase('complete');
      setResult(resultWithExtras);
      setProgress(prev => ({
        ...prev,
        phase: 'complete',
        downloadSpeed: testResult.measurement?.download.sustainedMbps ?? null,
        uploadSpeed: testResult.measurement?.upload.sustainedMbps ?? null,
        ping: testResult.latencyStats?.p50 ?? null,
        jitter: testResult.latencyStats?.pdv ?? null,
        downloadProgress: 100,
        uploadProgress: 100,
      }));

      // Copy to clipboard if enabled
      if (settings.autoCopyResults) {
        navigator.clipboard?.writeText(formatResultSummary(resultWithExtras, null, null)).catch(() => {});
      }

      onComplete?.(resultWithExtras);
    } catch (err) {
      if (!current()) return;
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Test stopped') return; // User-initiated stop, not an error
      setPhase('error');
      setProgress(prev => ({ ...prev, phase: 'error', error: message }));
    } finally {
      releaseWakeLock();
      abortController.abort();
      if (current()) { runningRef.current = false; providerRef.current = null; abortRef.current = null; }
    }
  }, [settings, onComplete]);

  const stopTest = useCallback(() => {
    abortRef.current?.abort();
    providerRef.current?.stop();
  }, []);

  const resetTest = useCallback(() => {
    runRef.current++; runningRef.current = false; providerRef.current?.stop(); abortRef.current?.abort(); providerRef.current = null;
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
  if (r.measurement) return formatV5Result(r);
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
      // 'insufficient' means the merge declined to grade agreement (< 3
      // sources) — pairing it with a concrete I² would contradict that call.
      const i2 = r.agreement.band !== 'insufficient' && r.agreement.i2 != null
        ? ` (I² ${(r.agreement.i2 * 100).toFixed(0)}%)`
        : '';
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
