/**
 * Vultr speed test provider (download-only, SpeedQX Methodology v4, §3).
 *
 * Ookla-style multi-PoP server selection: races a 2x `Range: bytes=0-0` probe
 * against 8 candidate PoPs in parallel (first probe per PoP discarded as
 * connection warm-up, second kept) and picks the PoP with the lowest kept
 * RTT. Download throughput is then measured via adaptively-sized ranged GETs
 * against the winning PoP's 100 MiB test file, streamed through the fetch
 * body's `ReadableStream` and tick-sampled every 250ms on a clock that is
 * independent of request/chunk boundaries — the same general technique used
 * by the CacheFly provider, implemented independently here (no shared code).
 * Latency is a dedicated series of 10 ranged 1-byte probes to the chosen PoP
 * (first 2 discarded as warm-up, headline = min of the remaining 8).
 *
 * Upload is not supported (`uploadSupported = false`) — Vultr only publishes
 * a public download test file per PoP. Packet loss is not measured (no
 * TURN/UDP path here). See METHODOLOGY.md §3 (capability prior 0.95) and §5
 * (per-provider pipeline) for how this slots into the cross-provider merge.
 */

import type { SpeedTestProvider, SpeedTestProgress, SpeedTestResult, TestDuration } from '../types/speedtest';
import { computeLatencyStats, plateauStart, filterOutliersIQR, modifiedTrimean, hodgesLehmann } from './statistics';

// ── Candidate PoPs (live-verified 2026-07-06: ACAO: *, Range-supported) ────
// nj-us / lax-ca-us / fra-de / sgp verified with a live ranged request during
// this implementation pass (206 Partial Content, Content-Range total =
// 104,857,600 bytes = 100 MiB); the remaining four are per the task registry.

const CANDIDATE_POPS = [
  'nj-us',
  'lax-ca-us',
  'fra-de',
  'sgp',
  'syd-au',
  'tyo-jp',
  'ams-nl',
  'lon-gb',
] as const;

const POP_DISPLAY_NAMES: Record<string, string> = {
  'nj-us': 'New Jersey, US',
  'lax-ca-us': 'Los Angeles, US',
  'fra-de': 'Frankfurt, DE',
  sgp: 'Singapore',
  'syd-au': 'Sydney, AU',
  'tyo-jp': 'Tokyo, JP',
  'ams-nl': 'Amsterdam, NL',
  'lon-gb': 'London, GB',
};

const TEST_FILE_NAME = 'vultr.com.100MB.bin';
/** Live-verified via `Content-Range: bytes 0-0/104857600` (2026-07-06). */
const FILE_SIZE_BYTES = 104_857_600;

function popUrl(pop: string): string {
  return `https://${pop}-ping.vultr.com/${TEST_FILE_NAME}`;
}

// ── Download tuning ─────────────────────────────────────────────────────

/** Throughput tick cadence — independent of request/chunk boundaries. */
const SAMPLE_INTERVAL_MS = 250;
/** First ranged request, before any rate estimate exists. */
const INITIAL_CHUNK_BYTES = 1_000_000;
/** Floor so slow links don't collapse into request-overhead-dominated chunks. */
const MIN_CHUNK_BYTES = 262_144;
/** Ceiling — comfortably under the 100 MiB file even on very fast links. */
const MAX_CHUNK_BYTES = 50_000_000;
/** "~2s of transfer at the last measured rate" per METHODOLOGY.md §5 step 1. */
const TARGET_CHUNK_SECONDS = 2;
/** Per-chunk safety timeout — guards against a single stalled request eating
 *  the whole test (e.g. a very slow link on the very first, un-adapted chunk). */
const CHUNK_TIMEOUT_MS = 15_000;

const DEFAULT_TEST_SECONDS = 10;

const LATENCY_PROBE_COUNT = 10;
const LATENCY_DISCARD_COUNT = 2;

/** Per-probe safety timeout for PoP selection. A SYN-blackholed / firewalled
 *  PoP never rejects on its own — the fetch just hangs — so without this a
 *  single unreachable candidate would stall the whole run at the browser's
 *  default connection timeout (tens of seconds). Vultr runs only in FULL, which
 *  the orchestrator arms no hard cap for, so this timeout is the sole safety net.
 *  Bounds each ranged RTT probe independently. */
const POP_PROBE_TIMEOUT_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Derives a signal that aborts when EITHER `parent` aborts (user stop) OR
 * `timeoutMs` elapses, without requiring `AbortSignal.any`/`.timeout()`
 * (kept dependency-free; both are broadly available by 2026 but this avoids
 * relying on it). Used only for download chunk fetches — the tiny 1-byte
 * probes below intentionally skip this and rely on the passed-in signal
 * directly, matching `latency-engine.ts`'s existing convention.
 */
function chunkFetchSignal(parent: AbortSignal, timeoutMs: number): AbortSignal {
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

// ── Ranged RTT probe (shared by PoP selection + latency phase) ──────────

/**
 * Single `Range: bytes=0-0` RTT probe. Mirrors `latency-engine.ts`'s
 * `measurePing`: PerformanceResourceTiming when trustworthy, else wall-clock.
 * Vultr's PoP hosts don't send `Timing-Allow-Origin` (only `ACAO: *`), so in
 * practice `responseStart`/`requestStart` read back as 0 for these
 * cross-origin requests and every probe falls through to the wall-clock
 * fallback — the guard below is kept for correctness/portability regardless.
 */
async function measureRangedRtt(url: string, signal?: AbortSignal): Promise<number> {
  const cacheBust = `${url}?_t=${Date.now()}&_r=${Math.random()}`;

  const t0 = performance.now();
  const res = await fetch(cacheBust, {
    method: 'GET',
    headers: { Range: 'bytes=0-0' },
    mode: 'cors',
    cache: 'no-store',
    signal,
  });
  await res.arrayBuffer(); // drain the 1-byte body so the connection is released promptly
  const fallbackRtt = performance.now() - t0;

  try {
    const entries = performance.getEntriesByName(cacheBust, 'resource') as PerformanceResourceTiming[];
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

// ── PoP selection ─────────────────────────────────────────────────────────

interface PopSelection {
  pop: string;
  rtt: number;
}

async function probePop(pop: string, signal: AbortSignal): Promise<PopSelection | null> {
  const url = popUrl(pop);
  try {
    // Each probe is independently time-bounded via chunkFetchSignal so a
    // blackholed PoP aborts (and is discarded below) instead of hanging forever.
    await measureRangedRtt(url, chunkFetchSignal(signal, POP_PROBE_TIMEOUT_MS)); // warm-up probe — discarded
    const rtt = await measureRangedRtt(url, chunkFetchSignal(signal, POP_PROBE_TIMEOUT_MS)); // kept
    return { pop, rtt };
  } catch (err) {
    console.warn(`[Vultr] PoP probe failed for ${pop}:`, err);
    return null;
  }
}

/** Races the 2x-probe sequence across all candidate PoPs and picks min-RTT.
 *  `allSettled` (not `all`) so one probe that rejects can never sink the whole
 *  selection; combined with the per-probe timeout above, an unreachable PoP
 *  degrades to "not in the reachable set" rather than stalling the run. */
async function selectPop(signal: AbortSignal): Promise<PopSelection | null> {
  const settled = await Promise.allSettled(CANDIDATE_POPS.map((pop) => probePop(pop, signal)));
  const reachable = settled
    .filter((r): r is PromiseFulfilledResult<PopSelection | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((a): a is PopSelection => a !== null);
  if (reachable.length === 0) return null;
  reachable.sort((a, b) => a.rtt - b.rtt);
  return reachable[0];
}

// ── Latency phase (10 probes, discard first 2, min) ──────────────────────

interface LatencyProbeResult {
  ping: number;
  samples: number[];
}

async function measureLatencyToPop(url: string, signal: AbortSignal): Promise<LatencyProbeResult> {
  const all: number[] = [];
  for (let i = 0; i < LATENCY_PROBE_COUNT; i++) {
    if (signal.aborted) break;
    try {
      all.push(await measureRangedRtt(url, signal));
    } catch {
      // Skip failed probes — don't pollute the sample set.
    }
  }
  // Only discard when there's enough to discard AND still have something left;
  // otherwise use whatever came back rather than collapsing to zero samples.
  const kept = all.length > LATENCY_DISCARD_COUNT ? all.slice(LATENCY_DISCARD_COUNT) : all;
  const ping = kept.length > 0 ? Math.min(...kept) : 0;
  return { ping, samples: kept };
}

// ── Download phase (adaptive ranged GETs, 250ms streamed sampling) ──────

type DownloadTickHandler = (mbps: number, totalBytes: number, elapsedMs: number) => void;

async function runRangedDownload(
  url: string,
  testDurationMs: number,
  signal: AbortSignal,
  onTick: DownloadTickHandler,
): Promise<number[]> {
  const rawSamples: number[] = [];
  const startTime = performance.now();
  const deadline = startTime + testDurationMs;

  let offset = 0;
  let nextChunkBytes = INITIAL_CHUNK_BYTES;
  let intervalStart = startTime;
  let intervalBytes = 0;
  let totalBytes = 0;

  // Emits a sample once >= SAMPLE_INTERVAL_MS has elapsed since the last tick
  // (actual elapsed time is used in the rate calc, not the nominal 250ms) —
  // this clock runs continuously across chunk/request boundaries. `force`
  // flushes a trailing partial interval at the very end of the test.
  const flush = (now: number, force = false) => {
    const elapsed = now - intervalStart;
    if (!force && elapsed < SAMPLE_INTERVAL_MS) return;
    if (elapsed <= 0) return;
    if (intervalBytes > 0) {
      const mbps = (intervalBytes * 8) / (elapsed / 1000) / 1e6;
      rawSamples.push(mbps);
      onTick(mbps, totalBytes, now - startTime);
    }
    intervalBytes = 0;
    intervalStart = now;
  };

  while (performance.now() < deadline && !signal.aborted) {
    const size = Math.round(Math.min(MAX_CHUNK_BYTES, Math.max(MIN_CHUNK_BYTES, nextChunkBytes)));
    const start = offset;
    const end = Math.min(start + size, FILE_SIZE_BYTES) - 1;

    const cacheBust = `${url}?_t=${Date.now()}&_r=${Math.random()}`;
    const chunkSignal = chunkFetchSignal(signal, CHUNK_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(cacheBust, {
        headers: { Range: `bytes=${start}-${end}` },
        mode: 'cors',
        cache: 'no-store',
        signal: chunkSignal,
      });
    } catch (err) {
      if (signal.aborted) break;
      console.warn('[Vultr] Chunk request failed, retrying:', err);
      await sleep(250);
      continue;
    }

    if (!response.ok) {
      console.warn(`[Vultr] Unexpected status ${response.status} for ranged request — restarting from offset 0.`);
      // Cancel the undrained body so the connection is released promptly rather
      // than left dangling for GC — matters if a PoP starts 4xx/5xx-ing mid-test
      // and we re-fetch every iteration until the deadline.
      try {
        await response.body?.cancel();
      } catch {
        /* noop */
      }
      offset = 0;
      continue;
    }
    if (response.status !== 206) {
      console.warn(`[Vultr] Expected 206 Partial Content, got ${response.status}.`);
    }

    const reader = response.body?.getReader();
    if (!reader) break; // streaming unsupported — abandon rather than spin

    let chunkBytes = 0;
    const chunkStart = performance.now();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunkBytes += value.byteLength;
          intervalBytes += value.byteLength;
          totalBytes += value.byteLength;
        }
        const now = performance.now();
        flush(now);
        if (now >= deadline || signal.aborted) {
          try {
            await reader.cancel();
          } catch {
            /* noop */
          }
          break;
        }
      }
    } catch (err) {
      if (!signal.aborted) console.warn('[Vultr] Stream read error:', err);
    }

    const chunkSeconds = (performance.now() - chunkStart) / 1000;
    if (chunkSeconds > 0 && chunkBytes > 0) {
      const rateBps = (chunkBytes * 8) / chunkSeconds;
      nextChunkBytes = (rateBps * TARGET_CHUNK_SECONDS) / 8;
    }

    offset = end + 1 >= FILE_SIZE_BYTES ? 0 : end + 1;
  }

  flush(performance.now(), true);
  return rawSamples;
}

// ── Provider ──────────────────────────────────────────────────────────────

export class VultrProvider implements SpeedTestProvider {
  name = 'Vultr';
  supportsPacketLoss = false;
  requiresConsent = false;
  /** Download-only — no upload leg. Not yet on `SpeedTestProvider`; see the
   *  implementer's final report for the suggested type addition. */
  uploadSupported = false;

  private controller: AbortController | null = null;

  async start(onProgress: (p: SpeedTestProgress) => void, duration: TestDuration = 'auto'): Promise<SpeedTestResult> {
    const controller = new AbortController();
    this.controller = controller;
    const { signal } = controller;

    const testSeconds = duration === 'auto' ? DEFAULT_TEST_SECONDS : duration;

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
      serverName: null,
      error: null,
    });

    const selection = await selectPop(signal);
    if (!selection) {
      console.error('[Vultr] PoP selection failed — no reachable candidate.');
      throw new Error('[Vultr] No reachable candidate PoP — all probes failed');
    }
    const { pop, rtt: selectionRtt } = selection;
    const displayName = POP_DISPLAY_NAMES[pop] ?? pop;
    const serverName = `Vultr (${displayName})`;
    const fileUrl = popUrl(pop);
    console.log('[Vultr] Selected PoP:', pop, `${selectionRtt.toFixed(1)}ms`);

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
      serverName,
      error: null,
    });

    // No explicit "stopped" throw here: like cloudflare/ndt7-provider.ts, an
    // abort from here on degrades gracefully — measureLatencyToPop() and
    // runRangedDownload() both check `signal.aborted` internally and simply
    // return whatever partial samples exist (possibly none), so the promise
    // still resolves with an honest (if minimal) result rather than rejecting.

    // ── Latency: 10 ranged 1-byte probes, discard first 2, min-RTT ───────
    const { ping, samples: latencySamples } = await measureLatencyToPop(fileUrl, signal);
    const latencyStats = computeLatencyStats(latencySamples);

    onProgress({
      phase: 'latency',
      currentProvider: this.name,
      ping,
      jitter: latencyStats.jitter,
      downloadSpeed: null,
      uploadSpeed: null,
      packetLoss: null,
      downloadProgress: 0,
      uploadProgress: 0,
      serverName,
      error: null,
    });

    // ── Download: adaptive-sized ranged GETs, 250ms streamed sampling ────
    const testDurationMs = testSeconds * 1000;
    const rawSamples = await runRangedDownload(fileUrl, testDurationMs, signal, (mbps, _bytes, elapsedMs) => {
      onProgress({
        phase: 'download',
        currentProvider: this.name,
        ping,
        jitter: latencyStats.jitter,
        downloadSpeed: mbps,
        uploadSpeed: null,
        packetLoss: null,
        downloadProgress: Math.min(99, (elapsedMs / testDurationMs) * 100),
        uploadProgress: 0,
        serverName,
        error: null,
      });
    });

    // Local best-effort estimate (plateau discard -> IQR -> modified trimean —
    // METHODOLOGY.md §5 steps 2/3/5). The shared circular-block-bootstrap
    // variance (step 7) needs a PCG32 stream threaded across providers IN
    // REGISTRY ORDER, so that stays the orchestrator's job; raw `rawSamples`
    // below is untouched for it to reprocess.
    const cutIdx = plateauStart(rawSamples);
    const afterPlateau = rawSamples.slice(cutIdx);
    const cleaned = filterOutliersIQR(afterPlateau, 1.5);
    const basis = cleaned.length > 0 ? cleaned : afterPlateau;
    const downloadSpeed = basis.length > 0 ? modifiedTrimean(basis) : 0;
    const hl = basis.length > 0 ? hodgesLehmann(basis) : 0;
    const unstableFlag = downloadSpeed > 0 && Math.abs(hl - downloadSpeed) / downloadSpeed > 0.15;

    onProgress({
      phase: 'download',
      currentProvider: this.name,
      ping,
      jitter: latencyStats.jitter,
      downloadSpeed,
      uploadSpeed: null,
      packetLoss: null,
      downloadProgress: 100,
      uploadProgress: 0,
      serverName,
      error: null,
    });

    console.log('[Vultr] Final:', {
      pop, ping, downloadSpeed, samples: rawSamples.length, unstableFlag,
    });

    return {
      provider: 'vultr',
      ping,
      jitter: latencyStats.jitter,
      downloadSpeed,
      uploadSpeed: 0,
      packetLoss: null,
      serverName,
      timestamp: Date.now(),
      latencyStats,
      bandwidthSamples: { download: rawSamples, upload: [] },
      vultrPop: pop,
      selectionRttMs: selectionRtt,
      unstableFlag,
    } as any;
  }

  stop() {
    this.controller?.abort();
  }
}
