/**
 * CacheFly speed test provider — HTTP download-only, HTTP range-based
 * (METHODOLOGY.md §3, capability prior 0.95).
 *
 * Public CDN test files at `cachefly.cachefly.net/{1,10,100}mb.test`
 * (`ACAO: *` and Range-request support live-verified 2026-07-06). There is no
 * upload endpoint at all — CacheFly is structurally download-only per the
 * spec's own provider table (same category as vultr-provider.ts, unlike
 * fastcom-provider.ts's "out of scope for this pass" upload gap).
 *
 * Progressive ladder (adaptive sizing per the v4 statistical notes, mirroring
 * qube-network-diagnostics's `adaptive_chunk_bytes`):
 *   1. `1mb.test` × 2 — fixed warm-up, timed as whole requests only (no
 *      interval sampling), discarded from `bandwidthSamples`; used solely to
 *      seed the first rate estimate for the mid tier.
 *   2. `10mb.test` × N — at least {@link MIN_MID_TIER_REQUESTS} full-file
 *      requests for a stable reading, then escalate once a full 10MB
 *      transfer undershoots the ~2s target at the last measured rate.
 *   3. `100mb.test` × N — `Range: bytes=0-{N-1}` (always from byte 0, per the
 *      task spec — not a walking offset like vultr-provider.ts's ranged
 *      walk), sized to ~2s at the last measured rate, repeated until the
 *      download budget is spent.
 *
 * Mid + large tier bytes are streamed through the fetch body's
 * `ReadableStream` into a SINGLE continuous 250ms ticker that spans request
 * (and tier) boundaries — the same technique vultr-provider.ts uses, so a
 * request boundary never manufactures a spurious tiny tail sample.
 *
 * Latency is a dedicated 10-probe `HEAD` + `Range: bytes=0-0` ladder against
 * `1mb.test` (first 2 discarded as TCP/TLS warm-up, headline = min RTT of the
 * remaining 8) — CacheFly's own edge path, feeding the cross-source min-RTT
 * headline (METHODOLOGY.md §4) alongside the shared Cloudflare latency
 * engine and every other provider's own ping.
 *
 * ── What this provider deliberately does NOT do ───────────────────────────
 * It does not compute its own bootstrap variance / BCa interval. The v4
 * circular block bootstrap (METHODOLOGY.md §5 step 7) draws from a single
 * PCG32 stream threaded across ALL providers in registry order (cloudflare,
 * ndt7, msak, librespeed, fastcom, cachefly, vultr, applenq — see the v4
 * statistical notes), so that responsibility belongs to the cross-provider
 * orchestrator, not to this file. This provider exposes raw, time-ordered
 * ~250ms Mbps samples (`bandwidthSamples`) for that purpose, plus a
 * same-pipeline-minus-bootstrap point estimate (plateau discard → IQR k=1.5
 * → modified trimean, with a Hodges-Lehmann instability cross-check) as its
 * own reported `downloadSpeed` — matching every other new v4 provider file.
 */

import type { SpeedTestProvider, SpeedTestProgress, SpeedTestResult, TestDuration } from '../types/speedtest';
import { computeLatencyStats, plateauStart, filterOutliersIQR, modifiedTrimean, hodgesLehmann } from './statistics';

const CACHEFLY_HOST = 'https://cachefly.cachefly.net';
const WARMUP_URL = `${CACHEFLY_HOST}/1mb.test`;
const MID_URL = `${CACHEFLY_HOST}/10mb.test`;
const LARGE_URL = `${CACHEFLY_HOST}/100mb.test`;
const LATENCY_URL = `${CACHEFLY_HOST}/1mb.test`;

// ── Download tuning ────────────────────────────────────────────────────────
const WARMUP_REQUESTS = 2;
const MIN_MID_TIER_REQUESTS = 2;
const MAX_MID_TIER_REQUESTS = 6;
const MAX_LARGE_TIER_REQUESTS = 500; // safety valve; never expected to bind
/** "~2s of transfer at the last measured rate" per METHODOLOGY.md §5 step 1. */
const TARGET_REQUEST_SECS = 2.0;
/** Floor for the adaptively-ranged 100mb.test requests. */
const RANGE_MIN_BYTES = 2_000_000;
/** Ceiling — safely under the nominal 100MB (decimal) / 100MiB (binary) file either way. */
const RANGE_MAX_BYTES = 100_000_000;
/** Throughput tick cadence — independent of request/tier boundaries. */
const SAMPLE_TICK_MS = 250;
const MAX_CONSECUTIVE_FAILURES = 3;
/** Per-request safety timeout (matches fastcom-/vultr-provider.ts's identical constant). */
const DOWNLOAD_REQUEST_TIMEOUT_MS = 15_000;
const RETRY_BACKOFF_MS = 200;
/** No pinned value in METHODOLOGY.md for 'auto'; matches fastcom-provider.ts's
 *  identical AUTO_DOWNLOAD_SECS choice for the same download-only shape. */
const DEFAULT_DOWNLOAD_SECS = 15;

// ── Latency tuning ─────────────────────────────────────────────────────────
const LATENCY_PROBES = 10;
const LATENCY_WARMUP_DISCARD = 2;
const LATENCY_PROBE_TIMEOUT_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A signal that aborts when `parent` aborts (user stop) OR `timeoutMs`
 * elapses, whichever is first. Hand-rolled rather than `AbortSignal.any`/
 * `.timeout()` for maximum runtime compatibility (matches fastcom-/
 * vultr-provider.ts's identical helper).
 */
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

function bytesToMbps(bytes: number, elapsedMs: number): number {
  if (elapsedMs <= 0 || bytes <= 0) return 0;
  return (bytes * 8) / (elapsedMs / 1000) / 1_000_000;
}

/**
 * Mirrors qube-network-diagnostics's `adaptive_chunk_bytes` (v4 statistical
 * notes): size the next request to ~targetSecs at the last measured rate,
 * clamped to [min, max]. Non-finite/non-positive input falls back to `min`
 * (the safe warm-up size).
 */
function adaptiveChunkBytes(lastMbps: number, targetSecs: number, min: number, max: number): number {
  if (!Number.isFinite(lastMbps) || lastMbps <= 0 || !Number.isFinite(targetSecs) || targetSecs <= 0) {
    return min;
  }
  const bytes = ((lastMbps * 1_000_000) / 8) * targetSecs;
  if (!Number.isFinite(bytes)) return max;
  return Math.min(max, Math.max(min, Math.round(bytes)));
}

/**
 * GET with an optional `Range: bytes=0-{rangeBytes-1}` header and
 * cache-busting query params. Returns `null` on any network/CORS error
 * (never throws) or a non-2xx status.
 */
async function rawGet(url: string, rangeBytes: number | undefined, signal: AbortSignal): Promise<Response | null> {
  const cacheBust = `${url}?_t=${Date.now()}&_r=${Math.random()}`;
  const headers: Record<string, string> = {};
  if (rangeBytes && rangeBytes > 0) {
    headers.Range = `bytes=0-${Math.max(0, Math.round(rangeBytes) - 1)}`;
  }
  try {
    const resp = await fetch(cacheBust, { method: 'GET', mode: 'cors', cache: 'no-store', headers, signal });
    return resp.ok ? resp : null;
  } catch {
    return null;
  }
}

/**
 * Whole-response timing with no interval bucketing — used only for the fixed
 * 1MB warm-up requests, which exist solely to seed the first adaptive rate
 * estimate and never contribute to `bandwidthSamples`.
 */
async function timeWholeResponse(resp: Response): Promise<{ bytes: number; elapsedMs: number } | null> {
  const t0 = performance.now();
  try {
    const buf = await resp.arrayBuffer();
    const elapsedMs = performance.now() - t0;
    if (buf.byteLength <= 0) return null;
    return { bytes: buf.byteLength, elapsedMs };
  } catch {
    return null;
  }
}

interface DownloadTicker {
  addBytes(n: number): void;
  flush(now: number, force?: boolean): void;
}

/**
 * A 250ms throughput ticker whose clock runs continuously across request AND
 * tier boundaries (mirrors vultr-provider.ts's `flush`) — pushes a sample
 * into `rawSamples` (and calls `onTick`) only when a real ~250ms interval has
 * elapsed, so a request boundary never manufactures a spurious tiny tail
 * sample partway through a bucket.
 */
function makeDownloadTicker(startTime: number, rawSamples: number[], onTick: (mbps: number) => void): DownloadTicker {
  let intervalStart = startTime;
  let intervalBytes = 0;
  return {
    addBytes(n: number) {
      intervalBytes += n;
    },
    flush(now: number, force = false) {
      const elapsed = now - intervalStart;
      if (!force && elapsed < SAMPLE_TICK_MS) return;
      if (elapsed <= 0) return;
      if (intervalBytes > 0) {
        const mbps = bytesToMbps(intervalBytes, elapsed);
        rawSamples.push(mbps);
        onTick(mbps);
      }
      intervalBytes = 0;
      intervalStart = now;
    },
  };
}

/**
 * Streams `resp`'s body into `ticker` (adding bytes + periodic 250ms
 * flushes). Returns the WHOLE request's own bytes/elapsed — used only to
 * seed the next adaptive request size — or `null` if nothing was read.
 * Falls back to a single whole-response read if a streaming body isn't
 * available, so the ladder still gets one (coarser) sample instead of none.
 */
async function drainIntoTicker(
  resp: Response,
  ticker: DownloadTicker,
  signal: AbortSignal,
): Promise<{ bytes: number; elapsedMs: number } | null> {
  const t0 = performance.now();
  const reader = resp.body?.getReader();
  if (!reader) {
    const whole = await timeWholeResponse(resp);
    if (!whole) return null;
    ticker.addBytes(whole.bytes);
    ticker.flush(performance.now());
    return whole;
  }

  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        bytes += value.byteLength;
        ticker.addBytes(value.byteLength);
      }
      ticker.flush(performance.now());
      if (signal.aborted) {
        try {
          await reader.cancel();
        } catch {
          /* noop */
        }
        break;
      }
    }
  } catch {
    // Aborted or stream error mid-flight — still report what was transferred.
  }
  const elapsedMs = performance.now() - t0;
  if (bytes <= 0) return null;
  return { bytes, elapsedMs };
}

/**
 * Single `HEAD` probe with `Range: bytes=0-0` — measures RTT without a body.
 * Mirrors latency-engine.ts's `measurePing`: PerformanceResourceTiming when
 * trustworthy, else wall-clock.
 */
async function probeLatencyOnce(signal: AbortSignal): Promise<number | null> {
  const url = `${LATENCY_URL}?_t=${Date.now()}&_r=${Math.random()}`;
  const t0 = performance.now();
  try {
    await fetch(url, {
      method: 'HEAD',
      mode: 'cors',
      cache: 'no-store',
      headers: { Range: 'bytes=0-0' },
      signal,
    });
  } catch {
    return null;
  }
  const fallbackRtt = performance.now() - t0;

  try {
    const entries = performance.getEntriesByName(url, 'resource') as PerformanceResourceTiming[];
    if (entries.length > 0) {
      const entry = entries[entries.length - 1];
      const rtt = entry.responseStart - entry.requestStart;
      if (rtt > 0 && rtt < fallbackRtt * 3) return rtt;
    }
  } catch {
    // PerformanceResourceTiming unavailable — fall back to wall clock.
  }
  return fallbackRtt;
}

// ── Provider ─────────────────────────────────────────────────────────────

export class CacheFlyProvider implements SpeedTestProvider {
  name = 'CacheFly';
  supportsPacketLoss = false;
  requiresConsent = false;
  /** Download-only — no upload leg (CacheFly publishes no upload endpoint).
   *  Not yet on `SpeedTestProvider`; see the final report for the suggested
   *  type addition (matches vultr-provider.ts's identical convention). */
  uploadSupported = false;

  private controller: AbortController | null = null;
  private stopped = false;

  async start(onProgress: (p: SpeedTestProgress) => void, duration: TestDuration = 'auto'): Promise<SpeedTestResult> {
    this.stopped = false;
    this.controller = new AbortController();
    const signal = this.controller.signal;

    const emitProgress = (partial: Partial<SpeedTestProgress>) => {
      onProgress({
        phase: 'discovering',
        currentProvider: this.name,
        ping: null,
        jitter: null,
        downloadSpeed: null,
        uploadSpeed: null,
        packetLoss: null,
        downloadProgress: 0,
        uploadProgress: 0,
        serverName: 'CacheFly CDN',
        error: null,
        ...partial,
      });
    };

    emitProgress({ phase: 'discovering' });

    // ── Latency: 10 HEAD probes (Range: bytes=0-0), discard first 2, min RTT ──
    const rttSamples: number[] = [];
    for (let i = 0; i < LATENCY_PROBES; i++) {
      if (this.stopped) break;
      const rtt = await probeLatencyOnce(withTimeoutSignal(signal, LATENCY_PROBE_TIMEOUT_MS));
      if (rtt !== null) rttSamples.push(rtt);
    }
    const measuredRtts = rttSamples.length > LATENCY_WARMUP_DISCARD ? rttSamples.slice(LATENCY_WARMUP_DISCARD) : rttSamples;
    const hasLatency = measuredRtts.length > 0;
    const pingMs = hasLatency ? Math.min(...measuredRtts) : 0;
    const latencyStats = hasLatency ? computeLatencyStats(measuredRtts) : undefined;
    const jitterMs = latencyStats?.jitter ?? 0;

    emitProgress({ phase: 'latency', ping: hasLatency ? pingMs : null, jitter: hasLatency ? jitterMs : null });

    // ── Download: 1mb×2 warm-up, 10mb×N, 100mb×N adaptive Range ─────────────
    const totalSecs = duration === 'auto' ? DEFAULT_DOWNLOAD_SECS : duration;
    const totalMs = totalSecs * 1000;
    const phaseStart = performance.now();
    const deadline = phaseStart + totalMs;

    let liveMbps: number | null = null;
    let lastRequestMbps = 0;
    let totalDownloadBytes = 0;

    const reportDownloadProgress = () => {
      const elapsed = performance.now() - phaseStart;
      emitProgress({
        phase: 'download',
        ping: hasLatency ? pingMs : null,
        jitter: hasLatency ? jitterMs : null,
        downloadSpeed: liveMbps,
        downloadProgress: totalMs > 0 ? Math.min(100, (elapsed / totalMs) * 100) : 0,
        serverName: 'CacheFly CDN',
      });
    };

    // Warm-up — 2× 1MB requests, whole-request timing only. Discarded from
    // `bandwidthSamples`; used solely to seed the first adaptive rate estimate.
    for (let i = 0; i < WARMUP_REQUESTS; i++) {
      if (this.stopped || performance.now() >= deadline) break;
      const resp = await rawGet(WARMUP_URL, undefined, withTimeoutSignal(signal, DOWNLOAD_REQUEST_TIMEOUT_MS));
      if (!resp) continue;
      const result = await timeWholeResponse(resp);
      if (result) {
        lastRequestMbps = bytesToMbps(result.bytes, result.elapsedMs);
        liveMbps = lastRequestMbps;
        totalDownloadBytes += result.bytes;
        reportDownloadProgress();
      }
    }

    // Mid + large tiers share one continuous 250ms ticker — see makeDownloadTicker.
    const rawSamples: number[] = [];
    const ticker = makeDownloadTicker(performance.now(), rawSamples, (mbps) => {
      liveMbps = mbps;
      reportDownloadProgress();
    });

    // Mid tier — 10MB requests. Always at least MIN_MID_TIER_REQUESTS for a
    // stable reading, then escalate to the adaptively-ranged 100MB tier once
    // a full 10MB transfer undershoots the ~2s target at the last measured rate.
    let midRequests = 0;
    let midFailures = 0;
    while (!this.stopped && performance.now() < deadline && midRequests < MAX_MID_TIER_REQUESTS) {
      const resp = await rawGet(MID_URL, undefined, withTimeoutSignal(signal, DOWNLOAD_REQUEST_TIMEOUT_MS));
      if (!resp) {
        midFailures++;
        if (midFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.warn('[CacheFly] Mid-tier request failed repeatedly, abandoning tier.');
          break;
        }
        if (!this.stopped) await sleep(RETRY_BACKOFF_MS);
        continue;
      }
      midRequests++;
      const result = await drainIntoTicker(resp, ticker, signal);
      if (!result) {
        midFailures++;
        if (midFailures >= MAX_CONSECUTIVE_FAILURES) break;
        continue;
      }
      midFailures = 0;
      lastRequestMbps = bytesToMbps(result.bytes, result.elapsedMs);
      totalDownloadBytes += result.bytes;

      if (midRequests >= MIN_MID_TIER_REQUESTS && result.elapsedMs < TARGET_REQUEST_SECS * 1000) break;
    }

    // Large tier — 100mb.test, `Range: bytes=0-{N-1}` sized to ~2s at the
    // last measured rate (always from byte 0, per the task spec). Fills the
    // remainder of the download budget.
    let largeRequests = 0;
    let largeFailures = 0;
    while (!this.stopped && performance.now() < deadline && largeRequests < MAX_LARGE_TIER_REQUESTS) {
      const rangeBytes = adaptiveChunkBytes(lastRequestMbps, TARGET_REQUEST_SECS, RANGE_MIN_BYTES, RANGE_MAX_BYTES);
      const resp = await rawGet(LARGE_URL, rangeBytes, withTimeoutSignal(signal, DOWNLOAD_REQUEST_TIMEOUT_MS));
      if (!resp) {
        largeFailures++;
        if (largeFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.warn('[CacheFly] Large-tier request failed repeatedly, abandoning tier.');
          break;
        }
        if (!this.stopped) await sleep(RETRY_BACKOFF_MS);
        continue;
      }
      largeRequests++;
      const result = await drainIntoTicker(resp, ticker, signal);
      if (!result) {
        largeFailures++;
        if (largeFailures >= MAX_CONSECUTIVE_FAILURES) break;
        continue;
      }
      largeFailures = 0;
      lastRequestMbps = bytesToMbps(result.bytes, result.elapsedMs);
      totalDownloadBytes += result.bytes;
    }

    ticker.flush(performance.now(), true); // trailing partial bucket
    const downloadDurationS = (performance.now() - phaseStart) / 1000;

    // Honest failure: reject rather than resolve with fabricated zeros
    // (METHODOLOGY.md §7's "never fabricated" ethos, applied here to
    // throughput as well as packet loss) — matches librespeed-/fastcom-/
    // msak-provider.ts. A user-initiated stop() still resolves gracefully
    // with whatever partial data exists (matches cloudflare-/ndt7-provider.ts).
    if (!hasLatency && rawSamples.length === 0 && totalDownloadBytes === 0 && !this.stopped) {
      throw new Error('CacheFly: no successful latency or download transfers');
    }

    // ── Point estimate (METHODOLOGY.md §5 steps 2-3-5-6, minus bootstrap) ────
    const afterPlateau = rawSamples.length > 0 ? rawSamples.slice(plateauStart(rawSamples)) : [];
    const iqrBasis = afterPlateau.length > 0 ? afterPlateau : rawSamples;
    const cleaned = filterOutliersIQR(iqrBasis, 1.5);
    const basis = cleaned.length > 0 ? cleaned : iqrBasis;
    const downloadSpeed = basis.length > 0 ? modifiedTrimean(basis) : 0;
    const hl = basis.length > 0 ? hodgesLehmann(basis) : 0;
    const unstableFlag = downloadSpeed > 0 && Math.abs(hl - downloadSpeed) / downloadSpeed > 0.15;
    if (unstableFlag) {
      console.warn('[CacheFly] Hodges-Lehmann cross-check exceeded 15% — internal instability flag:', {
        trimean: downloadSpeed,
        hodgesLehmann: hl,
      });
    }

    emitProgress({
      phase: 'download',
      ping: hasLatency ? pingMs : null,
      jitter: hasLatency ? jitterMs : null,
      downloadSpeed,
      downloadProgress: 100,
      serverName: 'CacheFly CDN',
    });

    console.log('[CacheFly] Final:', {
      download: downloadSpeed,
      ping: pingMs,
      jitter: jitterMs,
      samples: rawSamples.length,
      bytes: totalDownloadBytes,
      unstableFlag,
    });

    return {
      provider: 'cachefly',
      ping: pingMs,
      jitter: jitterMs,
      downloadSpeed,
      // CacheFly never runs an upload phase — see `uploadSupported` above.
      // `0` here only satisfies the current required `number` type; it is
      // NOT a measurement. The empty `bandwidthSamples.upload` array is what
      // already makes `mergeProviders`'s MIN_MERGE_SAMPLES gate in
      // `statistics.ts` correctly exclude CacheFly from the upload merge
      // with zero orchestrator changes.
      uploadSpeed: 0,
      packetLoss: null,
      serverName: 'CacheFly CDN',
      timestamp: Date.now(),
      latencyStats,
      // Extra fields beyond the current SpeedTestResult type — same `as any`
      // convention (and field names/shapes) as librespeed-/fastcom-/msak-
      // provider.ts. See the final report for the exact types/speedtest.ts
      // additions an orchestrator would need to consume these formally.
      bandwidthSamples: { download: rawSamples, upload: [] },
      downloadBytes: totalDownloadBytes,
      uploadBytes: 0,
      downloadDurationS,
      uploadDurationS: 0,
      unstableFlag: { download: unstableFlag, upload: false },
      hodgesLehmann: { download: hl, upload: 0 },
    } as any;
  }

  stop() {
    this.stopped = true;
    this.controller?.abort();
    this.controller = null;
  }
}
