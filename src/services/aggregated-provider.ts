/**
 * SpeedQX v4 cross-provider orchestrator (METHODOLOGY.md §5–§6).
 *
 * Runs the selected providers SEQUENTIALLY (1000 ms transition gap between
 * them), applies the per-provider v4 pipeline to each provider's raw samples
 * (plateau warm-up discard → [upload: fastest 50%] → IQR k=1.5 → modified
 * trimean → Hodges–Lehmann cross-check → circular block bootstrap for the
 * variance), then performs the SpeedQX hybrid merge: capacity + consensus with
 * DerSimonian–Laird τ², HKSJ confidence intervals, I² agreement bands, the
 * 0.70 weight cap and capability priors. Latency is min-RTT across engine +
 * kernel MinRTTs; jitter is PDV; bufferbloat is delta-ms + grade + ratio + RPM
 * from Cloudflare's loaded-latency points.
 *
 * The block bootstrap draws from a SINGLE PCG32 stream threaded across providers
 * in registry order (download then upload per provider) so the index streams
 * are reproducible — see the v4 statistical notes.
 *
 * Per-provider failures are isolated: a provider that rejects is recorded with
 * `availability: 'failed'` and the run continues. FAST profile additionally
 * arms an empirical-Bernstein confidence-sequence early stop (RTT-gated,
 * per-interval providers) plus a 25 s per-provider hard cap.
 */

import type {
  SpeedTestProvider,
  SpeedTestProgress,
  SpeedTestResult,
  TestDuration,
  TestProfile,
  LatencyStats,
  BufferbloatResult,
  StabilityMetric,
  BandwidthEstimate,
  ProviderRunResult,
  MergeExclusionEntry,
  DirectionalMbpsWithCi,
  AgreementInfo,
  FlowDisclosure,
} from '../types/speedtest';
import {
  plateauStart,
  filterOutliersIQR,
  modifiedTrimean,
  coefficientOfVariation,
  computeLatencyStats,
  circularBlockBootstrap,
  mergeProviders,
  empiricalBernsteinCS,
  bufferbloatDelta,
  rpm as computeRpm,
  type MergeProviderInput,
  leaveOneOutOutlier,
  type MergeResult,
} from './statistics';
import { PCG32 } from './stat-primitives';
import { resolveProviderPlan, type RegistryProviderKey } from './provider-factory';
import { METHODOLOGY_VERSION } from './methodology-version';

// ── Tunables ────────────────────────────────────────────────────────────────

/** Inter-provider transition gap (METHODOLOGY.md §2). */
const TRANSITION_MS = 1000;
/** FAST-mode per-provider hard cap (METHODOLOGY.md §8). */
const HARD_CAP_MS = 25_000;
/** Grace period for a stopped provider's own promise to resolve before we synthesize. */
const GRACE_MS = 1500;
/**
 * Per-source liveness watchdog: no progress events for this long means the
 * source is wedged on something other than the network under test (rate
 * limiting, a silent socket, a dead service) — cut it off, keep its partial
 * data, continue the run. Honest paths emit progress at seconds scale.
 */
const STALL_MS = 30_000;
/** Longest we pause between sources waiting for a hidden page to become visible. */
const VISIBILITY_WAIT_MS = 5 * 60_000;
/** Flow-count / divergence "material" threshold. */
const DIVERGENCE_THRESHOLD = 0.30;
/** Cross-provider latency blend weight for Cloudflare (NDT7 gets the rest). */
const CF_LATENCY_WEIGHT = 0.4;

/** Providers that emit true per-interval throughput samples (safe for the CS early stop). */
const PER_INTERVAL_LIVE = new Set<RegistryProviderKey>(['msak', 'librespeed', 'fastcom', 'cachefly', 'vultr']);

const PROVIDER_LABELS: Record<string, string> = {
  cloudflare: 'Cloudflare',
  ndt7: 'M-Lab NDT7',
  msak: 'M-Lab MSAK',
  librespeed: 'LibreSpeed',
  fastcom: 'fast.com (estimate)',
  cachefly: 'CacheFly',
  vultr: 'Vultr',
  applenq: 'Apple networkQuality',
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Per-provider cleaning (METHODOLOGY.md §5 steps 2–4, minus bootstrap) ─────

function cleanDirection(raw: number[] | undefined, isUpload: boolean): number[] {
  if (!raw || raw.length === 0) return [];
  const afterPlateau = raw.slice(plateauStart(raw));
  const preIqr = isUpload
    ? [...afterPlateau].sort((a, b) => b - a).slice(0, Math.ceil(afterPlateau.length / 2))
    : afterPlateau;
  return filterOutliersIQR(preIqr, 1.5);
}

// ── Latency block blend (CF 0.4 / NDT7 0.6, then PDV) ────────────────────────

function blendLatency(cf?: LatencyStats, ndt?: LatencyStats): LatencyStats | undefined {
  if (cf && ndt) {
    const w = CF_LATENCY_WEIGHT;
    const wn = 1 - w;
    const b = (a: number, c: number) => a * w + c * wn;
    const p50 = b(cf.p50, ndt.p50);
    const p95 = b(cf.p95, ndt.p95);
    const jitter = b(cf.jitter, ndt.jitter);
    return {
      samples: [...cf.samples, ...ndt.samples],
      p50,
      p75: b(cf.p75, ndt.p75),
      p95,
      p99: b(cf.p99, ndt.p99),
      min: Math.min(cf.min, ndt.min),
      max: Math.max(cf.max, ndt.max),
      mean: b(cf.mean, ndt.mean),
      stddev: b(cf.stddev, ndt.stddev),
      jitter,
      jitterMad: b(cf.jitterMad, ndt.jitterMad),
      pdv: Math.max(0, p95 - p50),
      jitterRfc3550: jitter,
    };
  }
  const one = cf ?? ndt;
  if (!one) return undefined;
  return { ...one, pdv: Math.max(0, one.p95 - one.p50), jitterRfc3550: one.jitter };
}

/** Best per-provider min-RTT candidate (engine min, headline ping, kernel MinRTTs). */
function minRttCandidate(res: SpeedTestResult): number | null {
  const cands: number[] = [];
  if (res.ping && res.ping > 0) cands.push(res.ping);
  const ls = res.latencyStats;
  if (ls && ls.min > 0) cands.push(ls.min);
  const kernel = (res as any).kernelMinRttMs;
  if (typeof kernel === 'number' && kernel > 0) cands.push(kernel);
  const rtts = (res as any).rttSamples;
  if (Array.isArray(rtts) && rtts.length > 0) {
    const m = Math.min(...(rtts as number[]));
    if (m > 0) cands.push(m);
  }
  return cands.length > 0 ? Math.min(...cands) : null;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

interface RunOutcome {
  key: RegistryProviderKey;
  label: string;
  result: SpeedTestResult | null;
  availability: 'ran' | 'failed';
  error?: string;
}

export interface AggregatedProviderOptions {
  profile?: TestProfile;
  consent?: boolean;
}

export class AggregatedProvider implements SpeedTestProvider {
  name = 'SpeedQX (aggregated)';
  supportsPacketLoss = true;
  requiresConsent = true; // M-Lab providers are in the default set; the plan drops them without consent

  private profile: TestProfile;
  private consent: boolean;
  private stopped = false;
  private active: SpeedTestProvider | null = null;
  /** Measurement-integrity notices accumulated during the run (see types). */
  private runWarnings: string[] = [];

  constructor(opts: AggregatedProviderOptions = {}) {
    this.profile = opts.profile ?? 'full';
    this.consent = opts.consent ?? false;
  }

  async start(
    onProgress: (p: SpeedTestProgress) => void,
    duration: TestDuration = 'auto',
  ): Promise<SpeedTestResult> {
    this.stopped = false;
    this.runWarnings = [];

    const fast = this.profile === 'fast';
    const plan = resolveProviderPlan(this.profile, this.consent);
    // FULL: each provider gets the full requested duration (accuracy > speed).
    // FAST: 'auto' (short) per provider, with CS early-stop + 25 s cap.
    const providerDuration: TestDuration = fast ? 'auto' : duration;

    const ctx = { minRtt: Infinity };
    const runs: RunOutcome[] = [];

    for (let i = 0; i < plan.length; i++) {
      if (this.stopped) break;
      const { key, make } = plan[i];
      const label = PROVIDER_LABELS[key] ?? key;

      if (i > 0) {
        onProgress(this.transitionProgress(label, ctx.minRtt));
        await delay(TRANSITION_MS);
        if (this.stopped) break;
      }

      // Don't START a source while the page is hidden — the browser throttles
      // background transfers and every reading would be garbage-low. Wait for
      // visibility (bounded); if the page stays hidden, run anyway and let the
      // per-source hidden flag disclose it.
      await this.waitUntilVisible();
      if (this.stopped) break;

      const instance = make();
      this.active = instance;
      try {
        const result = await this.runOne(key, label, instance, providerDuration, fast, ctx, onProgress);
        runs.push({ key, label, result, availability: 'ran' });
        console.log(`[Aggregated] ${label} ran:`, {
          dl: result.downloadSpeed, ul: result.uploadSpeed, ping: result.ping,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'Test stopped' || this.stopped) break;
        console.warn(`[Aggregated] ${label} failed:`, message);
        runs.push({ key, label, result: null, availability: 'failed', error: message });
      } finally {
        this.active = null;
      }
    }

    if (this.stopped) throw new Error('Test stopped');

    return this.aggregate(runs, fast);
  }

  stop() {
    this.stopped = true;
    this.active?.stop();
    this.active = null;
  }

  /**
   * Assemble the run's measurement-integrity notices: per-source stall/hidden
   * warnings plus the leave-one-out influence diagnostic — when very-low
   * agreement is explained by a single incoherent source, name it (source-side
   * throttling or an overloaded test server, not your network).
   */
  private collectWarnings(
    dlInputs: MergeProviderInput[],
    ulInputs: MergeProviderInput[],
  ): string[] | undefined {
    const warnings = [...this.runWarnings];
    for (const [dir, inputs] of [['download', dlInputs], ['upload', ulInputs]] as const) {
      const outlier = leaveOneOutOutlier(inputs);
      if (outlier) {
        warnings.push(
          `${PROVIDER_LABELS[outlier.name] ?? outlier.name} disagreed strongly with every other ${dir} source ` +
          `(agreement recovers from I² ${(outlier.i2With * 100).toFixed(0)}% to ${(outlier.i2Without * 100).toFixed(0)}% without it) — ` +
          `likely source-side throttling or an overloaded test server, not your network`,
        );
      }
    }
    return warnings.length > 0 ? warnings : undefined;
  }

  /** Resolve when the page is visible (immediately if it already is, or if the
   *  wait cap expires — the caller's hidden flag then discloses the condition). */
  private waitUntilVisible(): Promise<void> {
    if (typeof document === 'undefined' || !document.hidden) return Promise.resolve();
    this.runWarnings.push(
      'the test paused between sources while the page was hidden (background transfers are throttled by the browser)',
    );
    return new Promise((resolve) => {
      const timer = setTimeout(finish, VISIBILITY_WAIT_MS);
      function finish() {
        clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVis);
        resolve();
      }
      function onVis() {
        if (!document.hidden) finish();
      }
      document.addEventListener('visibilitychange', onVis);
    });
  }

  // ── Single-provider run with CS early stop + hard cap + graceful stop ──────

  private async runOne(
    key: RegistryProviderKey,
    label: string,
    instance: SpeedTestProvider,
    providerDuration: TestDuration,
    fast: boolean,
    ctx: { minRtt: number },
    onProgress: (p: SpeedTestProgress) => void,
  ): Promise<SpeedTestResult> {
    const liveDl: number[] = [];
    const liveUl: number[] = [];
    let lastProgress: SpeedTestProgress | null = null;

    let requestStop!: () => void;
    const stopSignal = new Promise<'stopped'>((resolve) => {
      let armed = false;
      requestStop = () => {
        if (armed) return;
        armed = true;
        try { instance.stop(); } catch { /* noop */ }
        resolve('stopped');
      };
    });

    // Liveness watchdog: a source that emits no progress events for this long
    // is wedged on something other than the network under test (rate limiter,
    // silent socket, dead service). Cut it off and keep what it measured; the
    // aggregated run continues on the other sources. Honest paths emit progress
    // at seconds scale even on badly degraded links.
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    let resolveStall!: (v: 'stalled') => void;
    const stallPromise = new Promise<'stalled'>((resolve) => { resolveStall = resolve; });
    const armStall = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        try { instance.stop(); } catch { /* noop */ }
        resolveStall('stalled');
      }, STALL_MS);
    };
    armStall();

    // Browser throttling detection: samples collected while the page is hidden
    // (locked phone, background tab) are throttled by the browser and read low.
    let sawHidden = false;

    // Once this run settles, DROP any straggler events from its provider.
    // Engines can keep emitting after their promise resolves (loaded-latency
    // probes, packet-loss completion) — without this seal those events
    // interleave with the NEXT provider's progress and the UI flashes rapidly
    // between the two (observed as CF-upload ↔ NDT7-download flicker).
    let done = false;

    const wrapped = (p: SpeedTestProgress) => {
      if (done || this.stopped) return;
      armStall();
      if (typeof document !== 'undefined' && document.hidden) sawHidden = true;
      lastProgress = p;
      if (p.ping != null && p.ping > 0 && p.ping < ctx.minRtt) ctx.minRtt = p.ping;

      if (p.phase === 'download' && p.downloadSpeed != null && p.downloadSpeed > 0) {
        if (liveDl[liveDl.length - 1] !== p.downloadSpeed) liveDl.push(p.downloadSpeed);
        // FAST-mode anytime-valid early stop, per-interval providers only.
        // The RTT gate lives inside empiricalBernsteinCS (min-RTT > 50 ms ⇒
        // never stops); Infinity (RTT not yet measured) keeps the gate closed.
        if (fast && PER_INTERVAL_LIVE.has(key)) {
          const cs = empiricalBernsteinCS(liveDl, { minRttMs: ctx.minRtt });
          if (cs.stop) requestStop();
        }
      }
      if (p.phase === 'upload' && p.uploadSpeed != null && p.uploadSpeed > 0) {
        if (liveUl[liveUl.length - 1] !== p.uploadSpeed) liveUl.push(p.uploadSpeed);
      }

      onProgress({ ...p, currentProvider: label });
    };

    const started = instance
      .start(wrapped, providerDuration)
      .then((result) => ({ kind: 'result' as const, result }))
      .catch((error) => ({ kind: 'error' as const, error }));

    let capTimer: ReturnType<typeof setTimeout> | null = null;
    const capPromise = new Promise<'cap'>((resolve) => {
      if (!fast) return; // FULL mode runs to completion
      capTimer = setTimeout(() => {
        try { instance.stop(); } catch { /* noop */ }
        resolve('cap');
      }, HARD_CAP_MS);
    });

    const outcome = await Promise.race([started, stopSignal, capPromise, stallPromise]);
    done = true; // seal: no further events from this provider reach the UI
    if (capTimer) clearTimeout(capTimer);
    if (stallTimer) clearTimeout(stallTimer);

    if (sawHidden) {
      this.runWarnings.push(
        `${label} ran while the page was hidden — the browser throttles background transfers, so its readings may be low`,
      );
    }

    if (typeof outcome === 'object') {
      if (outcome.kind === 'result') return outcome.result;
      throw outcome.error;
    }

    if (outcome === 'stalled') {
      this.runWarnings.push(
        `${label} stopped responding (no progress for ${STALL_MS / 1000}s — possibly rate-limited or a source-side outage) and was cut off`,
      );
      if (liveDl.length === 0 && liveUl.length === 0) {
        throw new Error(`stalled — no progress for ${STALL_MS / 1000}s`);
      }
    }

    // 'stopped', 'cap', or 'stalled' — give start() a brief grace period to
    // resolve with real partial data; otherwise synthesize from live samples.
    const graced = await Promise.race([
      started,
      delay(GRACE_MS).then(() => ({ kind: 'timeout' as const })),
    ]);
    if (typeof graced === 'object' && graced.kind === 'result') return graced.result;
    if (typeof graced === 'object' && graced.kind === 'error' && liveDl.length === 0 && liveUl.length === 0) {
      throw graced.error;
    }
    return this.synthesizePartial(key, liveDl, liveUl, lastProgress, ctx.minRtt);
  }

  private synthesizePartial(
    key: RegistryProviderKey,
    liveDl: number[],
    liveUl: number[],
    lastProgress: SpeedTestProgress | null,
    minRtt: number,
  ): SpeedTestResult {
    const dlCleaned = cleanDirection(liveDl, false);
    const ulCleaned = cleanDirection(liveUl, true);
    return {
      provider: key,
      ping: lastProgress?.ping ?? (Number.isFinite(minRtt) ? minRtt : 0),
      jitter: lastProgress?.jitter ?? 0,
      downloadSpeed: dlCleaned.length > 0 ? modifiedTrimean(dlCleaned) : 0,
      uploadSpeed: ulCleaned.length > 0 ? modifiedTrimean(ulCleaned) : 0,
      packetLoss: null,
      serverName: lastProgress?.serverName ?? PROVIDER_LABELS[key] ?? key,
      timestamp: Date.now(),
      bandwidthSamples: { download: liveDl, upload: liveUl },
    } as any;
  }

  private transitionProgress(nextLabel: string, minRtt: number): SpeedTestProgress {
    return {
      phase: 'discovering',
      currentProvider: `Switching to ${nextLabel}`,
      ping: Number.isFinite(minRtt) ? minRtt : null,
      jitter: null,
      downloadSpeed: null,
      uploadSpeed: null,
      packetLoss: null,
      downloadProgress: 100,
      uploadProgress: 100,
      serverName: null,
      error: null,
    };
  }

  // ── Aggregation (merge + headline metrics + payload assembly) ─────────────

  private aggregate(runs: RunOutcome[], _fast: boolean): SpeedTestResult {
    const byKey = new Map<string, SpeedTestResult>();
    for (const r of runs) if (r.result) byKey.set(r.key, r.result);

    // Per-provider cleaning + block bootstrap (ONE PCG32 stream, registry order,
    // download then upload per provider — v4 statistical notes).
    const rng = new PCG32();
    const dlInputs: MergeProviderInput[] = [];
    const ulInputs: MergeProviderInput[] = [];
    const perProvider = new Map<string, { dlPoint: number | null; ulPoint: number | null; dlN: number; ulN: number }>();
    const pooledDlCleaned: number[] = [];
    const pooledUlCleaned: number[] = [];

    for (const run of runs) {
      if (!run.result) continue;
      const bs = run.result.bandwidthSamples ?? { download: [], upload: [] };
      const dlCleaned = cleanDirection(bs.download, false);
      const ulCleaned = cleanDirection(bs.upload, true);
      const dlBoot = circularBlockBootstrap(dlCleaned, rng);
      const ulBoot = circularBlockBootstrap(ulCleaned, rng);

      dlInputs.push({ name: run.key, y: dlBoot.thetaHat, v: dlBoot.variance, samples: dlCleaned.length, bca: { lower: dlBoot.ciLower, upper: dlBoot.ciUpper } });
      ulInputs.push({ name: run.key, y: ulBoot.thetaHat, v: ulBoot.variance, samples: ulCleaned.length, bca: { lower: ulBoot.ciLower, upper: ulBoot.ciUpper } });

      perProvider.set(run.key, {
        dlPoint: dlCleaned.length > 0 ? dlBoot.thetaHat : null,
        ulPoint: ulCleaned.length > 0 ? ulBoot.thetaHat : null,
        dlN: dlCleaned.length,
        ulN: ulCleaned.length,
      });
      pooledDlCleaned.push(...dlCleaned);
      pooledUlCleaned.push(...ulCleaned);
    }

    const dlMerge = mergeProviders(dlInputs);
    const ulMerge = mergeProviders(ulInputs);

    const fallbackMax = (dir: 'dl' | 'ul'): number => {
      let m = 0;
      for (const v of perProvider.values()) {
        const p = dir === 'dl' ? v.dlPoint : v.ulPoint;
        if (p != null && p > m) m = p;
      }
      return m;
    };
    const headlineDl = dlMerge.capacity > 0 ? dlMerge.capacity : fallbackMax('dl');
    const headlineUl = ulMerge.capacity > 0 ? ulMerge.capacity : fallbackMax('ul');

    // Headline ping — min-RTT across engine + kernel MinRTTs.
    let headlinePing = Infinity;
    for (const run of runs) {
      if (!run.result) continue;
      const c = minRttCandidate(run.result);
      if (c != null && c < headlinePing) headlinePing = c;
    }
    if (!Number.isFinite(headlinePing)) headlinePing = 0;

    // Latency block (CF 0.4 / NDT7 0.6) + PDV headline jitter.
    const cfRes = byKey.get('cloudflare');
    const ndtRes = byKey.get('ndt7');
    const latencyStats = blendLatency(cfRes?.latencyStats, ndtRes?.latencyStats);
    const headlineJitter = latencyStats?.pdv ?? latencyStats?.jitter ?? 0;

    // Bufferbloat delta + grade + ratio + RPM from Cloudflare's loaded-latency points.
    let bufferbloat = cfRes?.bufferbloat as BufferbloatResult | undefined;
    let rpmVal: number | undefined = (cfRes as any)?.rpm ?? undefined;
    const cfLoadedPts = (cfRes as any)?.loadedLatencyPoints as { download: number[]; upload: number[] } | undefined;
    const cfUnloadedPts = (cfRes as any)?.unloadedLatencyPoints as number[] | undefined;
    if (cfLoadedPts) {
      const loadedPooled = [...(cfLoadedPts.download ?? []), ...(cfLoadedPts.upload ?? [])];
      if (loadedPooled.length > 0) {
        const idle = cfUnloadedPts && cfUnloadedPts.length > 0 ? cfUnloadedPts : (cfRes?.latencyStats?.samples ?? []);
        const delta = bufferbloatDelta(idle, loadedPooled);
        rpmVal = computeRpm(loadedPooled);
        const idleP50 = idle.length > 0 ? computeLatencyStats(idle).p50 : 0;
        const dlP95 = (cfLoadedPts.download?.length ?? 0) > 0 ? computeLatencyStats(cfLoadedPts.download).p95 : 0;
        const ulP95 = (cfLoadedPts.upload?.length ?? 0) > 0 ? computeLatencyStats(cfLoadedPts.upload).p95 : 0;
        bufferbloat = {
          unloadedLatency: bufferbloat?.unloadedLatency ?? computeLatencyStats(idle),
          downloadLoadedLatency: bufferbloat?.downloadLoadedLatency ?? computeLatencyStats(cfLoadedPts.download ?? []),
          uploadLoadedLatency: bufferbloat?.uploadLoadedLatency ?? computeLatencyStats(cfLoadedPts.upload ?? []),
          downloadRatio: bufferbloat?.downloadRatio ?? (idleP50 > 0 ? dlP95 / idleP50 : 1),
          uploadRatio: bufferbloat?.uploadRatio ?? (idleP50 > 0 ? ulP95 / idleP50 : 1),
          grade: delta.grade,
          deltaMs: delta.deltaMs,
          ratio: delta.ratio,
          unloadedLatencyMs: idleP50,
          loadedLatencyMs: { download: dlP95, upload: ulP95 },
        };
      }
    }

    // Stability CV on pooled cleaned samples per direction.
    const dlCV = coefficientOfVariation(pooledDlCleaned);
    const ulCV = coefficientOfVariation(pooledUlCleaned);
    const stability: StabilityMetric | undefined =
      pooledDlCleaned.length > 2 || pooledUlCleaned.length > 2
        ? { downloadCV: dlCV, uploadCV: ulCV, downloadStable: dlCV < 0.15, uploadStable: ulCV < 0.15 }
        : undefined;

    // Flow-count disclosure: single-stream (NDT7) vs multi-stream (MSAK / capacity).
    const single = perProvider.get('ndt7')?.dlPoint ?? null;
    const multi = perProvider.get('msak')?.dlPoint ?? (headlineDl > 0 ? headlineDl : null);
    const flowDisclosure: FlowDisclosure | undefined =
      single != null && multi != null
        ? {
            singleStreamDownloadMbps: single,
            multiStreamDownloadMbps: multi,
            divergent: Math.max(single, multi) > 0 && Math.abs(single - multi) / Math.max(single, multi) > DIVERGENCE_THRESHOLD,
          }
        : undefined;

    // v4 schema fields.
    const capacityMbps: DirectionalMbpsWithCi = {
      download: headlineDl,
      upload: headlineUl,
      downloadCi: dlMerge.capacityCi,
      uploadCi: ulMerge.capacityCi,
    };
    const consensusMbps: DirectionalMbpsWithCi = {
      download: dlMerge.consensus,
      upload: ulMerge.consensus,
      downloadCi: dlMerge.consensusCi,
      uploadCi: ulMerge.consensusCi,
    };
    const agreement: AgreementInfo = { i2: dlMerge.i2, band: dlMerge.band };
    const uploadAgreement: AgreementInfo = { i2: ulMerge.i2, band: ulMerge.band };

    const mergeExclusions: MergeExclusionEntry[] = [
      ...dlMerge.exclusions.map((e) => ({ provider: e.name, direction: 'download' as const, samples: e.samples })),
      ...ulMerge.exclusions.map((e) => ({ provider: e.name, direction: 'upload' as const, samples: e.samples })),
    ];

    // Per-provider breakdown (registry order) + Apple NQ platform-unavailable.
    const providers: ProviderRunResult[] = runs.map((run) => {
      if (!run.result) {
        return {
          provider: run.key, name: run.label, server: null, availability: 'failed' as const,
          pingMs: null, downloadMbps: null, uploadMbps: null,
          samples: { download: 0, upload: 0 }, bytes: { download: 0, upload: 0 }, error: run.error,
        };
      }
      const pp = perProvider.get(run.key);
      return {
        provider: run.key, name: run.label, server: run.result.serverName ?? null, availability: 'ran' as const,
        pingMs: run.result.ping ?? null,
        downloadMbps: pp?.dlPoint ?? null,
        uploadMbps: pp?.ulPoint ?? null,
        samples: { download: pp?.dlN ?? 0, upload: pp?.ulN ?? 0 },
        bytes: { download: run.result.downloadBytes ?? 0, upload: run.result.uploadBytes ?? 0 },
      };
    });
    providers.push({
      provider: 'applenq', name: PROVIDER_LABELS.applenq, server: null,
      availability: 'unavailable-platform', pingMs: null, downloadMbps: null, uploadMbps: null,
      samples: { download: 0, upload: 0 }, bytes: { download: 0, upload: 0 },
    });

    // Legacy back-compat surfaces (populated for one release; see types).
    const dlMargin = Math.max(0, (dlMerge.capacityCi.upper - dlMerge.capacityCi.lower) / 2);
    const ulMargin = Math.max(0, (ulMerge.capacityCi.upper - ulMerge.capacityCi.lower) / 2);
    const downloadEstimate: BandwidthEstimate | undefined = headlineDl > 0 ? {
      value: headlineDl, ci95Lower: dlMerge.capacityCi.lower, ci95Upper: dlMerge.capacityCi.upper,
      ciMargin: dlMargin, method: 'v4 capacity (DL τ² + HKSJ)', sampleCount: pooledDlCleaned.length,
    } : undefined;
    const uploadEstimate: BandwidthEstimate | undefined = headlineUl > 0 ? {
      value: headlineUl, ci95Lower: ulMerge.capacityCi.lower, ci95Upper: ulMerge.capacityCi.upper,
      ciMargin: ulMargin, method: 'v4 capacity (DL τ² + HKSJ)', sampleCount: pooledUlCleaned.length,
    } : undefined;

    const bandLow = (m: MergeResult) => m.band === 'low' || m.band === 'very-low';
    const providerDivergence = {
      download: dlMerge.i2 ?? 0,
      upload: ulMerge.i2 ?? 0,
      significant: bandLow(dlMerge) || bandLow(ulMerge),
    };

    const ranCount = runs.filter((r) => r.result).length;
    const serverName = `SpeedQX · ${this.profile.toUpperCase()} · ${ranCount} source${ranCount === 1 ? '' : 's'}`;

    const result: SpeedTestResult = {
      provider: 'aggregated',
      ping: headlinePing,
      jitter: headlineJitter,
      downloadSpeed: headlineDl,
      uploadSpeed: headlineUl,
      packetLoss: cfRes?.packetLoss ?? null,
      serverName,
      timestamp: Date.now(),

      // v4 payload
      methodologyVersion: METHODOLOGY_VERSION,
      platform: 'web',
      providerSet: this.profile,
      capacityMbps,
      consensusMbps,
      agreement,
      uploadAgreement,
      rpm: rpmVal,
      providers,
      mergeExclusions,
      confidenceIntervals: { download: dlMerge.capacityCi, upload: ulMerge.capacityCi, confidenceLevel: 0.95 },
      flowDisclosure,
      warnings: this.collectWarnings(dlInputs, ulInputs),

      // stats blocks / legacy surfaces
      latencyStats,
      bufferbloat,
      stability,
      aimScores: (cfRes as any)?.aimScores,
      jitterBreakdown: (cfRes as any)?.jitterBreakdown,
      downloadEstimate,
      uploadEstimate,
      providerDivergence,
      providerResults: {
        cloudflare: cfRes as any,
        ndt7: ndtRes as any,
      },
    };

    console.log('[Aggregated] v4 merge:', {
      profile: this.profile,
      capacityDl: headlineDl, capacityUl: headlineUl,
      consensusDl: dlMerge.consensus, consensusUl: ulMerge.consensus,
      i2Dl: dlMerge.i2, bandDl: dlMerge.band,
      ping: headlinePing, jitter: headlineJitter, rpm: rpmVal,
      ran: ranCount, exclusions: mergeExclusions.length,
    });

    return result;
  }
}
