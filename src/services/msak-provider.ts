/**
 * M-Lab MSAK (throughput1) provider — the multi-stream successor to NDT7
 * (METHODOLOGY.md §3, capability prior 0.85).
 *
 * NDT7 deliberately measures single-TCP-flow bulk transport capacity, which
 * structurally underestimates on high-BDP or lossy paths. MSAK runs
 * `STREAMS` parallel WebSocket streams per direction and measures aggregate
 * capacity, the way Ookla-class tests do — a genuinely different signal even
 * against the same M-Lab fleet.
 *
 * Protocol (m-lab/msak, Apache-2.0; same open platform/policy as NDT7):
 * server discovery via `locate.measurementlab.net/v2/nearest/msak/
 * throughput1`, WebSocket subprotocol `net.measurementlab.throughput.v1`,
 * binary frames carry payload data, JSON text frames carry a
 * `WireMeasurement` ({Application,Network}.{BytesSent,BytesReceived},
 * ElapsedTime in µs, optional TCPInfo.{MinRTT,RTT} in µs). `streams` and
 * `duration` (ms, server-capped at 25000) are required query params on the
 * signed session URL the Locate API hands back.
 *
 * This ports the behavior of the CLI's Rust reference
 * (`qube-network-diagnostics/src/speedtest/msak.rs`): 500ms throughput
 * sampling aggregated across both streams, the shared M-Lab 16x-bytes-sent
 * upload frame growth rule (`ndt7.rs`'s `should_grow_frame` — MSAK reuses
 * NDT7's exact scaling rule per the spec), and kernel TCPInfo MinRTT/RTT
 * harvesting from server text messages. For upload, the server-reported
 * `Application.BytesReceived` is the throughput counter (receiver-side
 * truth), not the client's local bytes-sent count, which only measures
 * local buffer fill.
 *
 * ── Browser-specific additions not present in the Rust client ─────────────
 * tokio gives the Rust client real backpressure for free (`Sink::send`
 * blocks until the transport can accept more). A browser `WebSocket.send()`
 * is fire-and-forget — an unthrottled send loop would queue unboundedly in
 * `bufferedAmount` and could starve the event loop (blocking the 500ms
 * sampler and incoming RTT messages). The upload send loop here therefore
 * gates on `bufferedAmount` against a watermark and takes a periodic
 * macrotask yield, throttling frame-growth pacing to roughly what the link
 * can actually drain instead of racing ahead of it.
 *
 * ── What this provider deliberately does NOT do ────────────────────────────
 * It does not compute its own bootstrap variance / BCa interval. The v4
 * circular block bootstrap (METHODOLOGY.md §5 step 7) draws from a single
 * PCG32 stream threaded across ALL providers in registry order (cloudflare,
 * ndt7, msak, librespeed, fastcom, cachefly, vultr, applenq — see the v4
 * statistical notes), so that responsibility belongs to the cross-provider
 * orchestrator, not to this file. This provider exposes raw, time-ordered
 * per-tick Mbps samples (`bandwidthSamples`) for that purpose, plus a
 * same-pipeline-minus-bootstrap point estimate (plateau discard → [upload:
 * fastest 50%] → IQR k=1.5 → modified trimean, with a Hodges–Lehmann
 * instability cross-check) as its own reported `downloadSpeed`/
 * `uploadSpeed` — matching librespeed-provider.ts / vultr-provider.ts.
 */

import type {
  SpeedTestProvider,
  SpeedTestProgress,
  SpeedTestResult,
  TestDuration,
  TestPhase,
} from '../types/speedtest';
import {
  computeLatencyStats,
  plateauStart,
  filterOutliersIQR,
  modifiedTrimean,
  hodgesLehmann,
} from './statistics';

const LOCATE_URL = 'https://locate.measurementlab.net/v2/nearest/msak/throughput1';
const SUBPROTOCOL = 'net.measurementlab.throughput.v1';

/** Parallel streams per direction (the reference client default). */
const STREAMS = 2;

/** Server-side cap on a single subtest (milliseconds). */
const MAX_SERVER_DURATION_MS = 25_000;

/** Aggregate throughput sampling tick across both streams. */
const SAMPLE_INTERVAL_MS = 500;

/** Initial upload frame size (8 KiB) — shared M-Lab WebSocket message-scaling rule. */
const INITIAL_UPLOAD_FRAME_SIZE = 1 << 13;
/** Maximum upload frame size (1 MiB). */
const MAX_UPLOAD_FRAME_SIZE = 1 << 20;

/** Grow the upload frame once cumulative bytes sent reach 16x the current frame size. */
function shouldGrowFrame(frameSize: number, bytesSent: number): boolean {
  return frameSize < MAX_UPLOAD_FRAME_SIZE && bytesSent >= 16 * frameSize;
}

/** Backpressure watermark: pause sending new frames above this many buffered bytes. */
const BUFFERED_AMOUNT_HIGH_WATERMARK = 4 * MAX_UPLOAD_FRAME_SIZE; // 4 MiB
/** Macrotask yield cadence while unthrottled, so message/timer events stay responsive. */
const YIELD_EVERY_N_SENDS = 32;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Server discovery ────────────────────────────────────────────────────

interface LocateResult {
  machine: string;
  location: string | null;
  downloadUrl: string;
  downloadUrlWs: string | null;
  uploadUrl: string;
  uploadUrlWs: string | null;
}

/** Append the required/etiquette query params to a Locate URL (already signed with `access_token`). */
function buildSessionUrl(base: string, durationMs: number): string {
  const url = new URL(base);
  url.searchParams.set('streams', String(STREAMS));
  url.searchParams.set('duration', String(durationMs));
  url.searchParams.set('client_name', 'speedqx');
  url.searchParams.set('client_version', '1.0.0');
  url.searchParams.set('client_library_name', 'speedqx-web-msak');
  url.searchParams.set('client_library_version', '1.0.0');
  // M-Lab data-policy acknowledgement metadata — mirrors NDT7's
  // `userAcceptedDataPolicy: true` client-config flag. Not a required MSAK
  // protocol field (unrecognized query params are ignored server-side);
  // MSAKProvider.requiresConsent = true is the actual gate — start() is only
  // invoked once the app has confirmed the user accepted the M-Lab data
  // policy, exactly as with NDT7Provider.
  url.searchParams.set('user_accepted_data_policy', 'true');
  return url.toString();
}

async function locate(sessionMs: number, signal?: AbortSignal): Promise<LocateResult> {
  const resp = await fetch(LOCATE_URL, { signal });
  if (!resp.ok) {
    throw new Error(`MSAK discovery failed: HTTP ${resp.status}`);
  }
  const body = await resp.json();
  const results = body?.results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('MSAK discovery: no servers found');
  }
  const entry = results[0];
  const machine: string = entry?.machine || 'unknown';
  const city: string = entry?.location?.city || '';
  const country: string = entry?.location?.country || '';
  const location = city || country ? `${city}${city && country ? ', ' : ''}${country}` : null;

  const urls = entry?.urls || {};
  const downloadBase = urls['wss:///throughput/v1/download'];
  const uploadBase = urls['wss:///throughput/v1/upload'];
  if (typeof downloadBase !== 'string' || typeof uploadBase !== 'string') {
    throw new Error('MSAK discovery: missing wss download/upload URLs');
  }
  const downloadUrlWsBase = urls['ws:///throughput/v1/download'];
  const uploadUrlWsBase = urls['ws:///throughput/v1/upload'];

  return {
    machine,
    location,
    downloadUrl: buildSessionUrl(downloadBase, sessionMs),
    uploadUrl: buildSessionUrl(uploadBase, sessionMs),
    downloadUrlWs: typeof downloadUrlWsBase === 'string' ? buildSessionUrl(downloadUrlWsBase, sessionMs) : null,
    uploadUrlWs: typeof uploadUrlWsBase === 'string' ? buildSessionUrl(uploadUrlWsBase, sessionMs) : null,
  };
}

// ── WireMeasurement ingestion ───────────────────────────────────────────

interface StreamStats {
  minRtts: number[];
  rtts: number[];
}

/**
 * Harvest TCPInfo MinRTT/RTT (µs → ms) into `stats` and return the server-
 * reported received-byte count from a single WireMeasurement text frame
 * (`null` if absent/unparsable). Combining both extractions into one parse
 * avoids double-JSON.parse-ing the same frame.
 */
function ingestMeasurement(text: string, stats: StreamStats): number | null {
  let measurement: any;
  try {
    measurement = JSON.parse(text);
  } catch {
    return null;
  }
  const minRtt = measurement?.TCPInfo?.MinRTT;
  if (typeof minRtt === 'number' && minRtt > 0) stats.minRtts.push(minRtt / 1000);
  const rtt = measurement?.TCPInfo?.RTT;
  if (typeof rtt === 'number' && rtt > 0) stats.rtts.push(rtt / 1000);
  const received = measurement?.Application?.BytesReceived;
  return typeof received === 'number' ? received : null;
}

// ── WebSocket connect (wss → ws fallback, like NDT7) ────────────────────

function msakConnect(url: string, fallbackUrl: string | null, activeSockets: Set<WebSocket>): Promise<WebSocket> {
  const attempt = (target: string): Promise<WebSocket> => new Promise((resolve, reject) => {
    let settled = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(target, [SUBPROTOCOL]);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      if (settled) return;
      settled = true;
      activeSockets.add(ws);
      resolve(ws);
    };
    ws.onerror = () => {
      if (settled) return;
      settled = true;
      reject(new Error(`MSAK WebSocket connect failed: ${target}`));
    };
    ws.onclose = (ev) => {
      if (settled) return;
      settled = true;
      reject(new Error(`MSAK WebSocket closed before open: ${target} (code ${ev.code})`));
    };
  });

  return attempt(url).catch((err) => {
    if (!fallbackUrl) throw err;
    return attempt(fallbackUrl);
  });
}

/**
 * Read binary frames (byte counting) + harvest RTTs. Resolves once the
 * socket closes or the per-stream hard cap elapses; never rejects — a
 * connect failure just yields an empty-handed stream, mirroring the Rust
 * reference's `let Ok(ws) = ... else { return stats };`.
 */
function downloadStream(
  url: string,
  fallbackUrl: string | null,
  counter: { value: number },
  stats: StreamStats,
  hardCapMs: number,
  activeSockets: Set<WebSocket>,
): Promise<void> {
  return msakConnect(url, fallbackUrl, activeSockets)
    .then((ws) => new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(hardCapTimer);
        activeSockets.delete(ws);
        ws.close();
        resolve();
      };
      const hardCapTimer = setTimeout(finish, hardCapMs);
      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          ingestMeasurement(ev.data, stats);
        } else if (ev.data instanceof ArrayBuffer) {
          counter.value += ev.data.byteLength;
        }
      };
      ws.onclose = finish;
      ws.onerror = finish;
    }))
    .catch(() => { /* connect failed on both wss and ws — no samples from this stream */ });
}

/**
 * Send growing binary frames with `bufferedAmount` backpressure; the shared
 * counter tracks the latest server-reported received-byte count (receiver-
 * side truth — client bytes-sent only measures local buffer fill).
 */
async function uploadStream(
  url: string,
  fallbackUrl: string | null,
  counter: { value: number },
  stats: StreamStats,
  hardCapMs: number,
  activeSockets: Set<WebSocket>,
): Promise<void> {
  let ws: WebSocket;
  try {
    ws = await msakConnect(url, fallbackUrl, activeSockets);
  } catch {
    return;
  }

  let closed = false;
  let resolveClosed: () => void = () => {};
  const closedPromise = new Promise<void>((resolve) => { resolveClosed = resolve; });
  ws.onmessage = (ev) => {
    if (typeof ev.data !== 'string') return;
    const received = ingestMeasurement(ev.data, stats);
    if (received !== null) counter.value = received;
  };
  ws.onclose = () => {
    closed = true;
    activeSockets.delete(ws);
    resolveClosed();
  };
  ws.onerror = () => { closed = true; };

  let frameSize = INITIAL_UPLOAD_FRAME_SIZE;
  let uploadData = new Uint8Array(frameSize);
  let bytesSent = 0;
  let sentSinceYield = 0;
  const hardCapAt = performance.now() + hardCapMs;

  while (!closed && ws.readyState === WebSocket.OPEN && performance.now() < hardCapAt) {
    if (ws.bufferedAmount > BUFFERED_AMOUNT_HIGH_WATERMARK) {
      await delay(4);
      continue;
    }
    try {
      ws.send(uploadData);
    } catch {
      break;
    }
    bytesSent += frameSize;
    sentSinceYield += 1;
    if (shouldGrowFrame(frameSize, bytesSent)) {
      frameSize = Math.min(frameSize * 2, MAX_UPLOAD_FRAME_SIZE);
      uploadData = new Uint8Array(frameSize);
    }
    if (sentSinceYield >= YIELD_EVERY_N_SENDS) {
      sentSinceYield = 0;
      await delay(0);
    }
  }

  ws.close();
  // Drain any final measurement message(s) the server sends while the close
  // handshake completes (mirrors the Rust reference's post-close drain).
  await Promise.race([closedPromise, delay(5000)]);
  activeSockets.delete(ws);
}

// ── Direction transfer: STREAMS parallel sockets + 500ms aggregate sampler ─

type Direction = 'download' | 'upload';

interface TransferOutcome {
  /** 500ms aggregate throughput samples (Mbps) across both streams, time-ordered. */
  samples: number[];
  bytes: number;
  durationS: number;
  minRtts: number[];
  rtts: number[];
}

interface TransferProgress {
  frac: number;
  lastSampleMbps: number | null;
  minRttSoFar: number | null;
}

async function transfer(
  direction: Direction,
  url: string,
  fallbackUrl: string | null,
  expectedMs: number,
  safetyDeadlineMs: number,
  activeSockets: Set<WebSocket>,
  onProgress: (p: TransferProgress) => void,
): Promise<TransferOutcome> {
  const start = performance.now();
  // Per-stream absolute safety cap: server max session (25s) + generous
  // margin, regardless of the requested duration — mirrors the Rust
  // reference's `MAX_SERVER_DURATION_MS + 10_000`.
  const hardCapMs = MAX_SERVER_DURATION_MS + 10_000;

  const counters: { value: number }[] = Array.from({ length: STREAMS }, (): { value: number } => ({ value: 0 }));
  const statsList: StreamStats[] = Array.from({ length: STREAMS }, (): StreamStats => ({ minRtts: [], rtts: [] }));

  const streamPromises = counters.map((counter, i) => (
    direction === 'download'
      ? downloadStream(url, fallbackUrl, counter, statsList[i], hardCapMs, activeSockets)
      : uploadStream(url, fallbackUrl, counter, statsList[i], hardCapMs, activeSockets)
  ));

  const samples: number[] = [];
  let lastTotal = 0;
  let lastAt = start;

  const sampleTick = () => {
    const total = counters.reduce((s, c) => s + c.value, 0);
    const now = performance.now();
    const dt = (now - lastAt) / 1000;
    const db = Math.max(0, total - lastTotal);
    let lastSampleMbps: number | null = null;
    if (dt > 0.1 && db > 0) {
      lastSampleMbps = (db * 8) / (dt * 1_000_000);
      samples.push(lastSampleMbps);
    }
    lastTotal = total;
    lastAt = now;

    let minRttSoFar: number | null = null;
    for (const s of statsList) {
      for (const r of s.minRtts) {
        if (minRttSoFar === null || r < minRttSoFar) minRttSoFar = r;
      }
    }

    onProgress({ frac: Math.min(0.99, (now - start) / expectedMs), lastSampleMbps, minRttSoFar });
  };

  const samplerId = setInterval(sampleTick, SAMPLE_INTERVAL_MS);
  // Whichever comes first: both streams finishing (the normal case — the
  // server closes each socket once its `duration` session elapses) or the
  // outer safety deadline. Streams that outlive the race are abandoned here
  // but remain bounded by their own hardCapMs (mirrors the Rust reference's
  // "detached tasks bounded by their own read deadlines").
  await Promise.race([Promise.all(streamPromises), delay(safetyDeadlineMs)]);
  clearInterval(samplerId);

  const minRtts: number[] = [];
  const rtts: number[] = [];
  for (const s of statsList) {
    minRtts.push(...s.minRtts);
    rtts.push(...s.rtts);
  }

  return {
    samples,
    bytes: counters.reduce((s, c) => s + c.value, 0),
    durationS: (performance.now() - start) / 1000,
    minRtts,
    rtts,
  };
}

// ── Point-estimate pipeline (METHODOLOGY.md §5 steps 2-4, minus bootstrap) ─

/**
 * Plateau warm-up discard, then (upload only) keep the fastest 50%, then IQR
 * k=1.5 — identical to librespeed-provider.ts's `cleanForDirection`. The
 * circular block bootstrap (step 7) needs a shared PCG32 stream across all
 * providers in registry order, so that stays the orchestrator's job.
 */
function cleanForDirection(raw: number[], isUpload: boolean): number[] {
  if (raw.length === 0) return [];
  const afterPlateau = raw.slice(plateauStart(raw));
  const preIqr = isUpload
    ? [...afterPlateau].sort((a, b) => b - a).slice(0, Math.ceil(afterPlateau.length / 2))
    : afterPlateau;
  return filterOutliersIQR(preIqr, 1.5);
}

// ── Provider ────────────────────────────────────────────────────────────

export class MSAKProvider implements SpeedTestProvider {
  name = 'M-Lab MSAK';
  supportsPacketLoss = false;
  requiresConsent = true; // M-Lab platform, like NDT7

  private activeSockets = new Set<WebSocket>();
  private discoveryAbort: AbortController | null = null;
  /** Set by stop(); gates the download→upload progression so a stop during the
   *  download phase can't launch a brand-new full upload run after teardown. */
  private stopped = false;

  async start(onProgress: (p: SpeedTestProgress) => void, duration: TestDuration = 'auto'): Promise<SpeedTestResult> {
    this.activeSockets = new Set();
    this.stopped = false;

    const budgetSecs = duration === 'auto' ? 10 : duration;
    const budgetMs = budgetSecs * 1000;
    // The server hard-caps a single subtest at 25s regardless of what's
    // requested; used both as the session `duration` param and as the
    // progress-fraction denominator (using the raw, possibly much larger
    // `budgetMs` there would leave FULL-mode's progress bar stalled near 0%
    // for most of the test, then jump to 100% — the CLI doesn't have this
    // concern since it isn't rendering a smooth animated progress bar).
    const sessionMs = Math.min(budgetMs, MAX_SERVER_DURATION_MS);

    let currentPing: number | null = null;
    let currentDlMbps: number | null = null;
    let currentUlMbps: number | null = null;
    let currentServerName: string | null = null;

    const emit = (phase: TestPhase, dlProgress: number, ulProgress: number) => {
      onProgress({
        phase,
        currentProvider: this.name,
        ping: currentPing,
        jitter: null,
        downloadSpeed: currentDlMbps,
        uploadSpeed: currentUlMbps,
        packetLoss: null,
        downloadProgress: dlProgress,
        uploadProgress: ulProgress,
        serverName: currentServerName,
        error: null,
      });
    };

    emit('discovering', 0, 0);

    this.discoveryAbort = new AbortController();
    const discovered = await locate(sessionMs, this.discoveryAbort.signal);
    currentServerName = discovered.location ? `${discovered.machine} (${discovered.location})` : discovered.machine;
    console.log('[MSAK] Server:', currentServerName);
    emit('discovering', 0, 0);

    // No explicit "stopped" throw from here on: like cloudflare/ndt7/
    // librespeed/vultr-provider.ts, an abort degrades gracefully. stop()
    // force-closes every tracked socket, which promptly unwinds transfer()'s
    // stream promises, so this resolves with an honest (if partial/minimal)
    // result instead of rejecting mid-flight.

    // ── Download (both streams, progress 0-100%) ──────────────────────────
    const dl = await transfer(
      'download', discovered.downloadUrl, discovered.downloadUrlWs,
      sessionMs, budgetMs + 5000, this.activeSockets,
      ({ frac, lastSampleMbps, minRttSoFar }) => {
        if (lastSampleMbps !== null) currentDlMbps = lastSampleMbps;
        if (minRttSoFar !== null) currentPing = currentPing === null ? minRttSoFar : Math.min(currentPing, minRttSoFar);
        emit('download', frac * 100, 0);
      },
    );

    // ── Upload (both streams, progress 0-100%) ────────────────────────────
    // If stop() fired during the download phase, do NOT open a fresh upload
    // run: stop() already tore down every socket it knew about, and uploadStream
    // would open brand-new WebSockets that nothing remaining will ever close —
    // streaming a full upload for the user's whole budget after they hit stop.
    // Skip straight to result assembly with an empty upload set instead.
    let ul: TransferOutcome;
    if (this.stopped) {
      ul = { samples: [], bytes: 0, durationS: 0, minRtts: [], rtts: [] };
    } else {
      emit('upload', 100, 0);
      ul = await transfer(
        'upload', discovered.uploadUrl, discovered.uploadUrlWs,
        sessionMs, budgetMs + 5000, this.activeSockets,
        ({ frac, lastSampleMbps, minRttSoFar }) => {
          if (lastSampleMbps !== null) currentUlMbps = lastSampleMbps;
          if (minRttSoFar !== null) currentPing = currentPing === null ? minRttSoFar : Math.min(currentPing, minRttSoFar);
          emit('upload', 100, frac * 100);
        },
      );
    }

    // Honest failure: discovery succeeded but neither direction produced a
    // single usable sample. Reject rather than resolve with fabricated zeros
    // (METHODOLOGY.md §7's "never fabricated" ethos, applied here to
    // throughput as well as packet loss) — matches librespeed-provider.ts.
    if (dl.samples.length === 0 && ul.samples.length === 0) {
      throw new Error(`MSAK: connected to ${currentServerName} but no successful transfers completed`);
    }

    // ── Point estimates (plateau discard -> [upload: fastest 50%] -> IQR ->
    // modified trimean; bootstrap variance is the orchestrator's job) ──────
    const dlCleaned = cleanForDirection(dl.samples, false);
    const ulCleaned = cleanForDirection(ul.samples, true);
    const downloadSpeed = dlCleaned.length > 0 ? modifiedTrimean(dlCleaned) : 0;
    const uploadSpeed = ulCleaned.length > 0 ? modifiedTrimean(ulCleaned) : 0;

    // Hodges-Lehmann cross-check (METHODOLOGY.md §5 step 6) — an internal
    // instability signal, not a headline field. Logged, and attached below
    // as an extra field for a future-typed orchestrator to pick up.
    const dlHL = dlCleaned.length > 0 ? hodgesLehmann(dlCleaned) : 0;
    const ulHL = ulCleaned.length > 0 ? hodgesLehmann(ulCleaned) : 0;
    const dlUnstable = downloadSpeed > 0 && Math.abs(dlHL - downloadSpeed) / downloadSpeed > 0.15;
    const ulUnstable = uploadSpeed > 0 && Math.abs(ulHL - uploadSpeed) / uploadSpeed > 0.15;
    if (dlUnstable || ulUnstable) {
      console.warn('[MSAK] Hodges-Lehmann cross-check exceeded 15% — internal instability flag:', {
        download: { trimean: downloadSpeed, hodgesLehmann: dlHL, unstable: dlUnstable },
        upload: { trimean: uploadSpeed, hodgesLehmann: ulHL, unstable: ulUnstable },
      });
    }

    // Ping = minimum kernel MinRTT seen on any stream in either direction
    // (mirrors the Rust reference exactly). Falls back to the live-progress
    // running minimum if, oddly, no MinRTT samples survived into the final
    // arrays (shouldn't happen if any arrived at all).
    const allMinRtts = [...dl.minRtts, ...ul.minRtts];
    const ping = allMinRtts.length ? Math.min(...allMinRtts) : (currentPing ?? 0);

    // Jitter/latencyStats from TCPInfo.RTT (NOT MinRTT — MinRTT is
    // monotonic-non-increasing and would show near-zero spurious "jitter").
    const allRtts = [...dl.rtts, ...ul.rtts];
    const latencyStats = allRtts.length > 0 ? computeLatencyStats(allRtts) : undefined;
    const jitter = latencyStats?.jitter ?? 0;

    console.log('[MSAK] Final:', {
      server: currentServerName,
      download: downloadSpeed, upload: uploadSpeed, ping, jitter,
      dlSamples: dl.samples.length, ulSamples: ul.samples.length, rttSamples: allRtts.length,
    });

    return {
      provider: 'msak',
      ping,
      jitter,
      downloadSpeed,
      uploadSpeed,
      packetLoss: null,
      serverName: currentServerName ?? discovered.machine,
      timestamp: Date.now(),
      latencyStats,
      // Extra fields beyond the current SpeedTestResult type — see the
      // handoff report for the exact additions an orchestrator would need to
      // consume these formally instead of via `as any` (matches
      // librespeed-provider.ts's / vultr-provider.ts's identical convention).
      bandwidthSamples: { download: dl.samples, upload: ul.samples },
      downloadBytes: dl.bytes,
      uploadBytes: ul.bytes,
      downloadDurationS: dl.durationS,
      uploadDurationS: ul.durationS,
      unstableFlag: { download: dlUnstable, upload: ulUnstable },
      hodgesLehmann: { download: dlHL, upload: ulHL },
    } as any;
  }

  stop() {
    this.stopped = true;
    this.discoveryAbort?.abort();
    for (const ws of this.activeSockets) {
      ws.close();
    }
    this.activeSockets.clear();
  }
}
