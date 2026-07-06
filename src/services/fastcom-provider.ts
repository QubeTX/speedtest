/**
 * fast.com (Netflix) speed test provider — browser-side, download-only.
 *
 * fast.com's OCA (Open Connect Appliance) target discovery requires a live
 * API token that Netflix scrapes out of its own JS bundle on every page load;
 * a browser can't do that cross-origin, so this provider calls the Vercel
 * Edge relay (`api/fastcom-targets.ts`) instead, which mirrors the same
 * token/OCA flow qube-network-diagnostics runs natively in Rust
 * (`qube-network-diagnostics/src/speedtest/fastcom.rs`).
 *
 * OCA target URLs embed their byte range directly in the path (e.g.
 * `.../speedtest/range/0-26214400`) rather than via an HTTP `Range` header —
 * {@link withRangeBytes} rewrites that segment for adaptive request sizing.
 *
 * CORS discipline: the very first download request doubles as the
 * CORS-readability probe (per spec). If it throws, comes back non-OK, or its
 * body can't be read, the provider fails gracefully — it never fabricates a
 * download number from a request it couldn't actually verify.
 *
 * This provider intentionally measures DOWNLOAD ONLY. fast.com's upload path
 * is undocumented and out of scope for this pass — see the final report to
 * the orchestrator for the deviation note.
 *
 * Raw per-request samples are collected and handed back uncooked (matching
 * the existing `cloudflare-provider.ts` / `ndt7-provider.ts` / `librespeed-
 * provider.ts` convention) so the v4 cross-provider merge (`mergeProviders`
 * in `./statistics`) can apply its own plateau/IQR/bootstrap pipeline with a
 * shared PCG32 stream across providers in registry order. See
 * {@link toMergeInput} for a reference implementation of that hand-off. This
 * provider's own reported `downloadSpeed` is the same-pipeline-minus-
 * bootstrap point estimate (plateau discard → IQR k=1.5 → modified trimean),
 * plus a Hodges-Lehmann cross-check (METHODOLOGY.md §5 step 6) exactly like
 * `librespeed-provider.ts` computes today.
 *
 * CORS establishment tries each of the relay's returned OCA targets in turn
 * (not just the first) before declaring the provider failed — a single flaky
 * node shouldn't fail the whole test — but does NOT re-run discovery itself;
 * all targets come from one relay call, so a block that survives all of them
 * is treated as a real, provider-wide CORS/availability failure.
 */

import type { SpeedTestProvider, SpeedTestProgress, SpeedTestResult, TestDuration } from '../types/speedtest';
import type { MergeProviderInput } from './statistics';
import type { PCG32 } from './stat-primitives';
import {
  computeLatencyStats,
  plateauStart,
  filterOutliersIQR,
  modifiedTrimean,
  hodgesLehmann,
  circularBlockBootstrap,
} from './statistics';

// ── Constants ──────────────────────────────────────────────────────────────

/** Relative path to the Vercel Edge relay (see api/fastcom-targets.ts). Always
 *  same-origin from this website; an absolute URL would be needed to call it
 *  from the app's WebView (out of scope here — see the final report). */
const TARGETS_ENDPOINT = '/api/fastcom-targets';

const DISPLAY_NAME = 'fast.com (estimate)';

/** fast.com's natural auto-mode download duration (fastcom.rs AUTO_DOWNLOAD_SECS). */
const AUTO_DOWNLOAD_SECS = 15;

/** 10 probes, discard the first 2 as TCP/TLS warmup (mirrors fastcom.rs LATENCY_PROBES / LATENCY_WARMUP_DISCARD). */
const LATENCY_PROBES = 10;
const LATENCY_WARMUP_DISCARD = 2;
const LATENCY_PROBE_RANGE_BYTES = 1;
const LATENCY_PROBE_TIMEOUT_MS = 5_000;

/** Adaptive request sizing (v4 statistical notes): target ~2s of transfer per
 *  request at the last measured rate, clamped so slow links still sample
 *  often and fast links don't fire pathologically large single requests. */
const TARGET_REQUEST_SECS = 2.0;
const DOWNLOAD_MIN_BYTES = 1_000_000; // 1 MB floor — safe warmup / slow-link size
const DOWNLOAD_MAX_BYTES = 200_000_000; // 200 MB ceiling

const TARGETS_FETCH_TIMEOUT_MS = 10_000;
const DOWNLOAD_REQUEST_TIMEOUT_MS = 15_000;

// ── Public types ─────────────────────────────────────────────────────────

export type FastcomAvailability = 'ran' | 'failed';

/** fast.com's own view of the requesting client, relayed verbatim-ish by the
 *  edge function. Shape isn't publicly documented and may drift; treat
 *  `location` defensively (see {@link extractLocationLabel}). */
export interface FastcomClientInfo {
  ip: string | null;
  location: unknown;
}

/** Response shape from `/api/fastcom-targets` (see api/fastcom-targets.ts). */
export interface FastcomTargetsResponse {
  targets: string[];
  client: FastcomClientInfo | null;
  error?: string;
}

export interface FastcomRunOptions {
  duration?: TestDuration;
  onProgress?: (p: SpeedTestProgress) => void;
  /** Caller-owned abort signal. The `FastcomProvider` class wires its own via `stop()`. */
  signal?: AbortSignal;
}

/**
 * Full per-run detail — the shape a future N-provider merge orchestrator wants
 * (METHODOLOGY.md §9 `providers[]` entry: name/server/availability/ping/
 * download/samples/bytes/error). `providerId` is the lowercase registry key
 * used by `CAPABILITY_PRIORS` / `mergeProviders` in `./statistics`; `name` is
 * the human-readable label (matches `SpeedTestProvider.name` below).
 *
 * `runFastcomTest` never throws — every failure mode (dev-mode/missing relay,
 * empty target list, CORS-blocked OCA, zero successful transfers) resolves to
 * `availability: 'failed'` with a descriptive `error` instead of a rejection,
 * so the future orchestrator can treat failure as ordinary data. The
 * `FastcomProvider` class wrapper below re-throws on failure to match the
 * CURRENT `SpeedTestProvider` convention (cloudflare/ndt7 both reject).
 */
export interface FastcomRunDetail {
  providerId: 'fastcom';
  name: string;
  availability: FastcomAvailability;
  server: string | null;
  location: string | null;
  pingMs: number | null;
  jitterMs: number | null;
  downloadMbps: number | null;
  /** fast.com upload is out of scope for this provider (GET-only OCA range
   *  requests) — always null. Kept for §9 schema symmetry with other providers. */
  uploadMbps: null;
  /** Hodges-Lehmann cross-check on the cleaned samples (METHODOLOGY.md §5 step 6). */
  hodgesLehmannMbps: number | null;
  /** True when |HL - trimean| / trimean > 0.15 — internal instability signal, not a headline field. */
  unstable: boolean;
  samples: { download: number[]; upload: number[] };
  bytes: { download: number; upload: number };
  durationMs: { download: number; upload: number };
  error: string | null;
}

// ── Small pure helpers ─────────────────────────────────────────────────────

/** A signal that aborts when `parent` aborts OR `timeoutMs` elapses, whichever
 *  is first. Hand-rolled rather than `AbortSignal.any`/`.timeout` for maximum
 *  runtime compatibility. */
function withTimeoutSignal(parent: AbortSignal, timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  if (parent.aborted) {
    controller.abort();
  } else {
    parent.addEventListener('abort', () => controller.abort(), { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return controller.signal;
}

/**
 * OCA target URLs from the relay embed the byte range directly in the path
 * (e.g. `.../speedtest/range/0-26214400`) rather than an HTTP Range header —
 * rewrite that trailing segment to control payload size (adaptive sizing,
 * latency-probe sizing). Falls back to appending a fresh segment if the URL
 * doesn't match the expected shape (defensive; shouldn't trigger against the
 * relay's own output).
 */
function withRangeBytes(url: string, bytes: number): string {
  const n = Math.max(1, Math.round(bytes));
  if (/\/range\/\d+-\d+/.test(url)) {
    return url.replace(/\/range\/\d+-\d+/, `/range/0-${n}`);
  }
  const base = url.endsWith('/') ? url.slice(0, -1) : url;
  return `${base}/range/0-${n}`;
}

/** Mirrors qube-network-diagnostics' `adaptive_chunk_bytes` (fastcom.rs /
 *  adaptive.rs): size the next request to ~targetSecs at the last measured
 *  rate, clamped to [min, max]. Non-finite/non-positive input falls back to
 *  `min` (the safe warmup size). Applied to download here (the Rust reference
 *  only adaptive-sizes upload; see the final report for this deviation). */
function adaptiveChunkBytes(lastMbps: number | null, targetSecs: number, min: number, max: number): number {
  if (
    lastMbps === null ||
    !Number.isFinite(lastMbps) ||
    lastMbps <= 0 ||
    !Number.isFinite(targetSecs) ||
    targetSecs <= 0
  ) {
    return min;
  }
  const bytes = ((lastMbps * 1_000_000) / 8) * targetSecs;
  if (!Number.isFinite(bytes)) return max;
  return Math.min(max, Math.max(min, Math.round(bytes)));
}

function mbpsFrom(bytes: number, ms: number): number {
  if (ms <= 0) return 0;
  return (bytes * 8) / (ms / 1000) / 1_000_000;
}

/** Warm-up discard (plateau detector) + IQR outlier filter — the v4 cleaning
 *  steps that are safe to run per-provider (unlike the bootstrap, which needs
 *  a shared cross-provider RNG stream; see {@link toMergeInput}). */
function cleanSamples(samples: number[]): number[] {
  if (samples.length === 0) return [];
  const afterWarmup = samples.slice(plateauStart(samples));
  return filterOutliersIQR(afterWarmup);
}

/** Best-effort human-readable label from fast.com's client-location payload.
 *  Shape isn't publicly documented (string in some deployments, `{city,
 *  country}` in others) — returns null rather than guessing at an unknown shape. */
function extractLocationLabel(client: FastcomClientInfo | null): string | null {
  const loc = client?.location;
  if (!loc) return null;
  if (typeof loc === 'string') return loc;
  if (typeof loc === 'object') {
    const city = (loc as Record<string, unknown>).city;
    const country = (loc as Record<string, unknown>).country;
    if (typeof city === 'string' && typeof country === 'string') return `${city}, ${country}`;
    if (typeof city === 'string') return city;
    if (typeof country === 'string') return country;
  }
  return null;
}

function failedDetail(message: string, partial: Partial<FastcomRunDetail> = {}): FastcomRunDetail {
  return {
    providerId: 'fastcom',
    name: DISPLAY_NAME,
    availability: 'failed',
    server: null,
    location: null,
    pingMs: null,
    jitterMs: null,
    downloadMbps: null,
    uploadMbps: null,
    hodgesLehmannMbps: null,
    unstable: false,
    samples: { download: [], upload: [] },
    bytes: { download: 0, upload: 0 },
    durationMs: { download: 0, upload: 0 },
    error: message,
    ...partial,
  };
}

// ── Discovery ────────────────────────────────────────────────────────────

async function fetchTargets(baseSignal: AbortSignal): Promise<FastcomTargetsResponse> {
  const signal = withTimeoutSignal(baseSignal, TARGETS_FETCH_TIMEOUT_MS);
  const res = await fetch(TARGETS_ENDPOINT, {
    cache: 'no-store',
    signal,
    headers: { Accept: 'application/json' },
  });

  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok || !contentType.includes('application/json')) {
    // Vite dev server has no /api/* routes and SPA-falls-back to index.html
    // (200, text/html) — this is the expected "unavailable outside a Vercel
    // deploy" case, not a bug. Deployed builds always return real JSON here.
    throw new Error(`fastcom-targets endpoint unavailable (status=${res.status}, content-type="${contentType}")`);
  }

  const data: any = await res.json();
  const rawTargets = Array.isArray(data?.targets) ? data.targets : [];
  const targets: string[] = rawTargets.filter((t: unknown): t is string => typeof t === 'string' && t.length > 0);
  const client: FastcomClientInfo | null =
    data?.client && typeof data.client === 'object'
      ? { ip: typeof data.client.ip === 'string' ? data.client.ip : null, location: data.client.location ?? null }
      : null;

  return { targets, client, error: typeof data?.error === 'string' ? data.error : undefined };
}

// ── Latency (10 probes, discard 2 warmup) ─────────────────────────────────

async function measureLatency(
  targetUrl: string,
  baseSignal: AbortSignal,
): Promise<{ pingMs: number | null; jitterMs: number | null }> {
  const pingUrl = withRangeBytes(targetUrl, LATENCY_PROBE_RANGE_BYTES);
  const rtts: number[] = [];

  for (let i = 0; i < LATENCY_PROBES; i++) {
    if (baseSignal.aborted) break;
    const signal = withTimeoutSignal(baseSignal, LATENCY_PROBE_TIMEOUT_MS);
    const t0 = performance.now();
    try {
      await fetch(pingUrl, { method: 'HEAD', mode: 'cors', cache: 'no-store', signal });
      rtts.push(performance.now() - t0);
    } catch {
      // Skip a failed probe — some OCA paths may not support HEAD; the
      // download phase (GET) is the authoritative availability/CORS gate.
    }
  }

  const warm = Math.min(LATENCY_WARMUP_DISCARD, rtts.length);
  const trimmed = rtts.slice(warm);
  if (trimmed.length === 0) return { pingMs: null, jitterMs: null };

  const pingMs = Math.min(...trimmed);
  const jitterMs = trimmed.length >= 2 ? computeLatencyStats(trimmed).jitter : null;
  return { pingMs, jitterMs };
}

// ── Download (adaptive sizing; first attempt gates CORS-readability) ─────

type DownloadAttempt = { ok: true; bytes: number; ms: number } | { ok: false; reason: string };

/** One ranged GET against an OCA target; shared by the CORS-establishment
 *  gate and the steady-state download loop (only the byte count differs). */
async function attemptDownload(url: string, bytes: number, baseSignal: AbortSignal): Promise<DownloadAttempt> {
  if (baseSignal.aborted) return { ok: false, reason: 'stopped' };

  const rangedUrl = withRangeBytes(url, bytes);
  const signal = withTimeoutSignal(baseSignal, DOWNLOAD_REQUEST_TIMEOUT_MS);
  const t0 = performance.now();

  let res: Response;
  try {
    res = await fetch(rangedUrl, { mode: 'cors', cache: 'no-store', signal });
  } catch (err) {
    if (baseSignal.aborted) return { ok: false, reason: 'stopped' };
    return { ok: false, reason: `CORS/network blocked (${err instanceof Error ? err.message : String(err)})` };
  }

  // Defense-in-depth: under mode:'cors' a CORS-blocked cross-origin response
  // makes fetch() reject rather than resolve opaque, so this shouldn't
  // trigger in practice — kept in case of redirect/runtime quirks.
  if (res.type === 'opaque' || res.type === 'opaqueredirect') {
    return { ok: false, reason: `opaque response (type=${res.type})` };
  }
  if (!res.ok) {
    return { ok: false, reason: `HTTP ${res.status}` };
  }

  let buf: ArrayBuffer;
  try {
    buf = await res.arrayBuffer();
  } catch (err) {
    return { ok: false, reason: `body unreadable (${err instanceof Error ? err.message : String(err)})` };
  }
  if (buf.byteLength === 0) {
    return { ok: false, reason: 'empty body' };
  }

  return { ok: true, bytes: buf.byteLength, ms: performance.now() - t0 };
}

type CorsEstablishment =
  | { ok: true; bytes: number; ms: number; nextUrlIdx: number }
  | { ok: false; reason: string };

/**
 * The CORS-readability gate (spec: "FIRST download attempt verifies CORS
 * readability"). Tries each returned OCA target in turn — not just the
 * first — so one flaky node doesn't fail the whole provider; only declares
 * failure once EVERY target in the list has failed. All targets come from a
 * single relay call (same Netflix backbone), so a block that survives all of
 * them is a real, provider-wide CORS/availability failure, not something a
 * fresh discovery call would fix.
 */
async function establishCorsReadability(targets: string[], baseSignal: AbortSignal): Promise<CorsEstablishment> {
  let lastReason = 'no targets available';
  for (let i = 0; i < targets.length; i++) {
    if (baseSignal.aborted) return { ok: false, reason: 'stopped' };
    const attempt = await attemptDownload(targets[i], DOWNLOAD_MIN_BYTES, baseSignal);
    if (attempt.ok) return { ok: true, bytes: attempt.bytes, ms: attempt.ms, nextUrlIdx: i + 1 };
    lastReason = attempt.reason;
    console.warn(
      `[fastcom] OCA target unreachable or CORS-blocked, trying next candidate (${i + 1}/${targets.length}):`,
      lastReason,
    );
  }
  return { ok: false, reason: lastReason };
}

interface DownloadPhaseResult {
  samples: number[];
  totalBytes: number;
  elapsedMs: number;
  /** True when the FIRST attempt failed — the CORS-readability gate (spec:
   *  "mark provider failed gracefully" rather than continue with a partial number). */
  corsBlocked: boolean;
  firstError: string | null;
}

async function runDownloadPhase(
  targets: string[],
  durationSecs: number,
  baseSignal: AbortSignal,
  onSample?: (mbps: number, fracComplete: number) => void,
): Promise<DownloadPhaseResult> {
  const samples: number[] = [];
  let totalBytes = 0;
  const startedAt = performance.now();
  const deadline = startedAt + durationSecs * 1000;

  // CORS-readability establishment IS the first download attempt(s) (spec) —
  // the successful one also doubles as the first raw bandwidth sample,
  // exactly like fastcom.rs's own first (min-size) request.
  const first = await establishCorsReadability(targets, baseSignal);
  if (!first.ok) {
    return {
      samples: [],
      totalBytes: 0,
      elapsedMs: performance.now() - startedAt,
      corsBlocked: true,
      firstError: first.reason,
    };
  }

  totalBytes += first.bytes;
  let lastMbps = mbpsFrom(first.bytes, first.ms);
  samples.push(lastMbps);
  onSample?.(lastMbps, Math.min(0.98, (performance.now() - startedAt) / (durationSecs * 1000)));

  let urlIdx = first.nextUrlIdx;
  while (performance.now() < deadline && !baseSignal.aborted) {
    const url = targets[urlIdx % targets.length];
    urlIdx++;

    const bytes = adaptiveChunkBytes(lastMbps, TARGET_REQUEST_SECS, DOWNLOAD_MIN_BYTES, DOWNLOAD_MAX_BYTES);
    const result = await attemptDownload(url, bytes, baseSignal);
    if (result.ok) {
      totalBytes += result.bytes;
      lastMbps = mbpsFrom(result.bytes, result.ms);
      samples.push(lastMbps);
      onSample?.(lastMbps, Math.min(0.98, (performance.now() - startedAt) / (durationSecs * 1000)));
    } else if (!baseSignal.aborted) {
      console.warn('[fastcom] download request failed, continuing:', result.reason);
    }
  }

  return { samples, totalBytes, elapsedMs: performance.now() - startedAt, corsBlocked: false, firstError: null };
}

// ── Top-level orchestration (pure — never throws) ─────────────────────────

/**
 * Run the fast.com estimate end-to-end: relay discovery → latency (10 probes,
 * discard 2) → adaptive-sized download loop. Always resolves — failures are
 * reported via `availability: 'failed'` + `error`, never a rejection and
 * never a fabricated number (see METHODOLOGY.md §7's packet-loss "never
 * fabricate" principle, applied here to throughput/CORS failures too).
 */
export async function runFastcomTest(options: FastcomRunOptions = {}): Promise<FastcomRunDetail> {
  const { duration = 'auto', onProgress, signal } = options;
  const baseSignal = signal ?? new AbortController().signal;

  const emitProgress = (partial: Partial<SpeedTestProgress>): void => {
    if (!onProgress) return;
    onProgress({
      phase: 'discovering',
      currentProvider: DISPLAY_NAME,
      ping: null,
      jitter: null,
      downloadSpeed: null,
      uploadSpeed: null,
      packetLoss: null,
      downloadProgress: 0,
      uploadProgress: 0,
      serverName: null,
      error: null,
      ...partial,
    });
  };

  emitProgress({ phase: 'discovering' });

  let discovery: FastcomTargetsResponse;
  try {
    discovery = await fetchTargets(baseSignal);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[fastcom] target discovery failed, failing gracefully:', message);
    return failedDetail(message);
  }

  if (discovery.targets.length === 0) {
    const message = discovery.error ?? 'fast.com: no OCA targets returned';
    console.warn('[fastcom]', message);
    return failedDetail(message);
  }

  const location = extractLocationLabel(discovery.client);
  const server = discovery.targets[0];

  const { pingMs, jitterMs } = await measureLatency(server, baseSignal);
  emitProgress({ phase: 'latency', ping: pingMs, jitter: jitterMs, serverName: location });

  if (baseSignal.aborted) {
    return failedDetail('fast.com: stopped', { pingMs, jitterMs, server, location });
  }

  const seconds = duration === 'auto' ? AUTO_DOWNLOAD_SECS : duration;
  const dl = await runDownloadPhase(discovery.targets, seconds, baseSignal, (mbps, frac) => {
    emitProgress({
      phase: 'download',
      ping: pingMs,
      jitter: jitterMs,
      downloadSpeed: mbps,
      downloadProgress: frac * 100,
      serverName: location,
    });
  });

  if (dl.corsBlocked) {
    const message = `fast.com: OCA download blocked (${dl.firstError ?? 'CORS/opaque response'})`;
    console.warn('[fastcom]', message);
    return failedDetail(message, { pingMs, jitterMs, server, location });
  }

  if (dl.samples.length === 0) {
    const message = 'fast.com: no successful transfers';
    console.warn('[fastcom]', message);
    return failedDetail(message, { pingMs, jitterMs, server, location });
  }

  const cleaned = cleanSamples(dl.samples);
  const downloadMbps = cleaned.length > 0 ? modifiedTrimean(cleaned) : modifiedTrimean(dl.samples);

  // Hodges-Lehmann cross-check (METHODOLOGY.md §5 step 6) — an internal
  // instability signal, not a headline field (mirrors librespeed-provider.ts).
  const hodgesLehmannMbps = cleaned.length > 0 ? hodgesLehmann(cleaned) : null;
  const unstable =
    hodgesLehmannMbps !== null && downloadMbps > 0 && Math.abs(hodgesLehmannMbps - downloadMbps) / downloadMbps > 0.15;
  if (unstable) {
    console.warn('[fastcom] Hodges-Lehmann cross-check exceeded 15% — internal instability flag:', {
      trimean: downloadMbps,
      hodgesLehmann: hodgesLehmannMbps,
    });
  }

  emitProgress({
    phase: 'download',
    ping: pingMs,
    jitter: jitterMs,
    downloadSpeed: downloadMbps,
    downloadProgress: 100,
    serverName: location,
  });

  return {
    providerId: 'fastcom',
    name: DISPLAY_NAME,
    availability: 'ran',
    server,
    location,
    pingMs,
    jitterMs,
    downloadMbps,
    uploadMbps: null,
    hodgesLehmannMbps,
    unstable,
    samples: { download: dl.samples, upload: [] },
    bytes: { download: dl.totalBytes, upload: 0 },
    durationMs: { download: dl.elapsedMs, upload: 0 },
    error: null,
  };
}

/**
 * Reference bridge from a successful {@link FastcomRunDetail} to the v4 merge
 * pipeline's `MergeProviderInput` shape (`mergeProviders` in `./statistics`).
 *
 * NOT wired into anything automatically: the orchestrator must own a single
 * PCG32 stream threaded across ALL providers in registry order (cloudflare,
 * ndt7, msak, librespeed, fastcom, cachefly, vultr, applenq) per the v4
 * statistical notes, so it must call this (or equivalent logic) itself at the
 * right point in that sequence — this helper only performs the LOCAL half
 * (warm-up/IQR cleaning + bootstrap with the given `rng`) correctly. Returns
 * null when there's nothing usable to contribute (failed run, or zero cleaned
 * samples); `mergeProviders` handles the `samples < MIN_MERGE_SAMPLES`
 * exclusion case itself, so this doesn't pre-filter on count.
 */
export function toMergeInput(detail: FastcomRunDetail, rng: PCG32): MergeProviderInput | null {
  if (detail.availability !== 'ran' || detail.downloadMbps === null) return null;
  const cleaned = cleanSamples(detail.samples.download);
  if (cleaned.length === 0) return null;

  const boot = circularBlockBootstrap(cleaned, rng);
  return {
    name: 'fastcom',
    y: boot.thetaHat,
    v: boot.variance,
    samples: cleaned.length,
    bca: { lower: boot.ciLower, upper: boot.ciUpper },
  };
}

// ── SpeedTestProvider adapter (drop-in for the current provider contract) ─

/**
 * `SpeedTestProvider`-compatible wrapper around {@link runFastcomTest}.
 * Rejects on failure (matching the existing `CloudflareProvider`/`NDT7Provider`/
 * `LibreSpeedProvider` convention — all three reject today), logging via
 * `console.warn` first in every failure path (already done inside
 * `runFastcomTest`). Raw samples and the rest of the v4-relevant detail
 * (`bandwidthSamples`, `downloadBytes`/`uploadBytes`, `downloadDurationS`/
 * `uploadDurationS`, `unstableFlag`, `hodgesLehmann`) are flattened onto the
 * resolved result — the same `as any` convention and field names/shapes
 * `librespeed-provider.ts` already uses, since `SpeedTestResult` doesn't
 * declare these fields yet (see the final report for the suggested
 * `types/speedtest.ts` additions).
 */
export class FastcomProvider implements SpeedTestProvider {
  name = DISPLAY_NAME;
  supportsPacketLoss = false;
  requiresConsent = false;

  private controller: AbortController | null = null;
  private lastRun: FastcomRunDetail | null = null;

  async start(onProgress: (p: SpeedTestProgress) => void, duration: TestDuration = 'auto'): Promise<SpeedTestResult> {
    this.controller = new AbortController();
    const detail = await runFastcomTest({ duration, onProgress, signal: this.controller.signal });
    this.lastRun = detail;

    if (detail.availability === 'failed' || detail.downloadMbps === null) {
      throw new Error(detail.error ?? 'fast.com: unknown failure');
    }

    return {
      provider: 'fastcom',
      ping: detail.pingMs ?? 0,
      jitter: detail.jitterMs ?? 0,
      downloadSpeed: detail.downloadMbps,
      uploadSpeed: 0,
      packetLoss: null,
      serverName: detail.location ? `fast.com OCA (${detail.location})` : 'fast.com OCA',
      timestamp: Date.now(),
      // Extra fields beyond the current SpeedTestResult type — same `as any`
      // convention (and field names/shapes) as cloudflare-provider.ts /
      // ndt7-provider.ts / librespeed-provider.ts. See the final report for
      // the exact types/speedtest.ts additions an orchestrator would need to
      // consume these formally instead of via `as any`.
      bandwidthSamples: detail.samples,
      downloadBytes: detail.bytes.download,
      uploadBytes: detail.bytes.upload,
      downloadDurationS: detail.durationMs.download / 1000,
      uploadDurationS: detail.durationMs.upload / 1000,
      unstableFlag: { download: detail.unstable, upload: false },
      hodgesLehmann: { download: detail.hodgesLehmannMbps ?? 0, upload: 0 },
    } as any;
  }

  stop(): void {
    this.controller?.abort();
  }

  /**
   * The typed `FastcomRunDetail` from the most recent run — everything
   * `start()` flattens onto the `SpeedTestResult` via `as any`, plus
   * `providerId`/`availability`/`error`, without the casting. Convenient for
   * an orchestrator that wants to call this class directly (rather than the
   * lower-level {@link runFastcomTest}) but still wants typed access.
   */
  getLastRunDetail(): FastcomRunDetail | null {
    return this.lastRun;
  }
}
