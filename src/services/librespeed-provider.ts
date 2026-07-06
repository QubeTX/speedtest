/**
 * LibreSpeed provider — HTTP-based download/upload throughput measurement
 * against a public LibreSpeed backend (METHODOLOGY.md §3, capability prior
 * 0.95). Unlike the Cloudflare/NDT7 providers there is no vendor SDK here:
 * LibreSpeed backends are plain PHP endpoints (`garbage.php` streams random
 * bytes for download, `empty.php` discards a POSTed body for upload/ping),
 * so this provider talks to them directly via `fetch()` from the page's own
 * JS context (browser today; the app's WebView DOM component later, same TS).
 *
 * ── Why pinned backends, not a live server-list fetch ─────────────────────
 * The public LibreSpeed server list
 * (`https://librespeed.org/backend-servers/servers.json` — the modern
 * LibreSpeed project having moved its primary source off GitHub to Codeberg)
 * is itself served WITHOUT CORS headers — verified live 2026-07-06 (200 OK,
 * `Content-Type: application/json`, but no `Access-Control-Allow-Origin`
 * anywhere in the response). A browser can't read it cross-origin, so unlike
 * the Rust CLI counterpart (`qube-network-diagnostics/src/speedtest/
 * librespeed.rs`, which fetches that list server-side — no CORS involved —
 * and probes up to 30 candidates concurrently), this provider pins a fixed,
 * hand-verified candidate set instead of discovering one at runtime.
 *
 * Live CORS verification (2026-07-06, `Origin: https://speedqx.com`; GET
 * `garbage.php?cors=true&ckSize=4`, GET/POST/OPTIONS `empty.php?cors=true`):
 *
 *   PASS — `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods:
 *   GET, POST` on every response, including a simulated preflight OPTIONS
 *   (`Access-Control-Request-Method/Headers`) and a real POST with no
 *   `Content-Type` header at all (the no-preflight "simple request" path):
 *     - nyc.speedtest.clouvider.net/backend   (New York, US)   — PINNED PRIMARY
 *     - fra.speedtest.clouvider.net/backend   (Frankfurt, DE)  — PINNED SECONDARY
 *     - lon.speedtest.clouvider.net/backend   (London, UK)     — fallback
 *     - atl.speedtest.clouvider.net/backend   (Atlanta, US)    — fallback
 *     - la.speedtest.clouvider.net/backend    (Los Angeles, US)— fallback
 *     - librespeed.a573.net/backend           (Tokyo, JP)      — fallback
 *       (this one 403s a bare `curl` UA with no CORS headers at all, but
 *       returns 200 + full CORS headers for any realistic browser UA string
 *       — a UA-based bot filter, not a CORS problem, so it's fine for actual
 *       in-browser use and kept in the rotation, just not pinned as primary)
 *
 *   FAIL — excluded from the candidate set entirely (genuinely broken, not
 *   just slow — a browser would fail identically):
 *     - de1.backend.librespeed.org   — DNS NXDOMAIN
 *     - in1.backend.librespeed.org   — TLS cert principal mismatch (SNI/CN)
 *     - za1.backend.librespeed.org   — TLS cert EXPIRED
 *     - speedtest.dsgroupmedia.com   — DNS NXDOMAIN
 *
 * The two pinned backends are the most geo-diverse of the verified-reliable
 * set (US East + EU-Central, the two biggest transatlantic peering hubs);
 * the rest of the PASS list is the fallback rotation, tried in order. If a
 * pinned backend fails at runtime — network error, or the CORS-gated fetch
 * rejects — {@link LibreSpeedProvider["selectBackend"]} moves to the next
 * candidate automatically.
 *
 * ── Chunk sizing ───────────────────────────────────────────────────────────
 * `garbage.php`'s `ckSize` query parameter is empirically **MiB** (2^20
 * bytes), not decimal MB as the Rust reference's comment assumes — live-
 * verified: `ckSize=1` returned exactly 1,048,576 bytes, `ckSize=2` returned
 * exactly 2,097,152. Each request is sized to take about
 * {@link TARGET_REQUEST_SECS} at the previously measured rate (adaptive —
 * mirrors the Rust reference's `adaptive_chunk_bytes`), so the per-request
 * sample rate stays roughly constant across link speeds instead of yielding
 * 0-2 samples per test on slow links or absurdly many on fast ones.
 *
 * ── Upload payload ─────────────────────────────────────────────────────────
 * This deliberately uploads a **random** Blob rather than the Rust
 * reference's zero-filled buffer: zero bytes are trivially compressible, and
 * a transparent proxy that recompresses request bodies would bias an upload
 * measurement high. The Blob is constructed with no explicit MIME type, so
 * `fetch()` omits the `Content-Type` header entirely; combined with no
 * custom headers, that keeps the POST a CORS "simple request" (no preflight
 * round-trip) — though live verification confirmed both the no-preflight
 * simple POST and an explicit preflighted POST succeed identically on both
 * pinned backends, so this is a latency optimization, not a correctness
 * requirement.
 *
 * ── What this provider deliberately does NOT do ───────────────────────────
 * It does not compute its own bootstrap variance / BCa interval. The v4
 * circular block bootstrap (METHODOLOGY.md §5 step 7) draws from a single
 * PCG32 stream threaded across ALL providers in registry order (cloudflare,
 * ndt7, msak, librespeed, fastcom, cachefly, vultr, applenq — see the v4
 * statistical notes), so that responsibility belongs to the cross-provider
 * orchestrator, not to this file. This provider exposes raw, time-ordered
 * per-request Mbps samples (`bandwidthSamples`) for that purpose, plus a
 * same-pipeline-minus-bootstrap point estimate (plateau discard → [upload:
 * fastest 50%] → IQR k=1.5 → modified trimean) as its own reported
 * `downloadSpeed`/`uploadSpeed`, exactly like the Cloudflare/NDT7 providers
 * report a usable number today while still exposing samples for later
 * reprocessing.
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

// ── Backend registry ────────────────────────────────────────────────────

interface LibreSpeedBackend {
  name: string;
  /** Origin + optional path prefix, no trailing slash. */
  baseUrl: string;
  /** Path to the download (`garbage.php`) endpoint, no leading slash. */
  dlPath: string;
  /**
   * Path to the "black hole" endpoint (`empty.php`) — LibreSpeed backends
   * use this same endpoint for both the upload benchmark (POST, body
   * discarded) and ping/reachability probes (GET, empty response), no
   * leading slash.
   */
  ulPath: string;
}

/** Geo-diverse, live-CORS-verified 2026-07-06 (see file header). US East — one of the two largest transatlantic peering hubs. */
const PINNED_PRIMARY_BACKEND: LibreSpeedBackend = {
  name: 'New York, US (Clouvider)',
  baseUrl: 'https://nyc.speedtest.clouvider.net/backend',
  dlPath: 'garbage.php',
  ulPath: 'empty.php',
};

/** Live-CORS-verified 2026-07-06. EU-Central — maximally geo-diverse from the primary. */
const PINNED_SECONDARY_BACKEND: LibreSpeedBackend = {
  name: 'Frankfurt, Germany (Clouvider)',
  baseUrl: 'https://fra.speedtest.clouvider.net/backend',
  dlPath: 'garbage.php',
  ulPath: 'empty.php',
};

/**
 * Fallback rotation, tried in order after both pinned backends fail. All
 * live-CORS-verified 2026-07-06 (see file header for the full verification
 * table, including the four public backends that were tried and excluded
 * for genuine DNS/TLS failures).
 */
const FALLBACK_ROTATION_BACKENDS: LibreSpeedBackend[] = [
  {
    name: 'London, England (Clouvider)',
    baseUrl: 'https://lon.speedtest.clouvider.net/backend',
    dlPath: 'garbage.php',
    ulPath: 'empty.php',
  },
  {
    name: 'Atlanta, US (Clouvider)',
    baseUrl: 'https://atl.speedtest.clouvider.net/backend',
    dlPath: 'garbage.php',
    ulPath: 'empty.php',
  },
  {
    name: 'Los Angeles, US (Clouvider)',
    baseUrl: 'https://la.speedtest.clouvider.net/backend',
    dlPath: 'garbage.php',
    ulPath: 'empty.php',
  },
  {
    name: 'Tokyo, Japan (A573)',
    baseUrl: 'https://librespeed.a573.net',
    dlPath: 'backend/garbage.php',
    ulPath: 'backend/empty.php',
  },
];

/** Full candidate set, in try-order: both pins, then the fallback rotation. */
const CANDIDATE_BACKENDS: LibreSpeedBackend[] = [
  PINNED_PRIMARY_BACKEND,
  PINNED_SECONDARY_BACKEND,
  ...FALLBACK_ROTATION_BACKENDS,
];

// ── Tunables ─────────────────────────────────────────────────────────────

/**
 * Each transfer request is sized to take roughly this long at the
 * last-measured rate (METHODOLOGY.md §5 step 1: adaptive request sizing).
 */
const TARGET_REQUEST_SECS = 2.0;

const DOWNLOAD_MIN_BYTES = 1_000_000;
const DOWNLOAD_MAX_BYTES = 100_000_000;

/** 16 MB stays comfortably under common LibreSpeed backend POST size limits. */
const UPLOAD_MIN_BYTES = 256 * 1024;
const UPLOAD_MAX_BYTES = 16_000_000;

/** Per-request timeout floor so a stalled transfer can't outlive the phase. */
const MIN_REQUEST_TIMEOUT_MS = 1000;

/** Reachability/CORS probe timeout while selecting a backend. */
const SELECTION_PROBE_TIMEOUT_MS = 5000;

/** Discarded warm-up probes per backend during selection (DNS+TCP+TLS amortization). */
const SELECTION_WARMUP_PROBES = 2;

/** Additional measured latency probes collected after a backend is selected. */
const LATENCY_PROBE_COUNT = 8;
const LATENCY_PROBE_INTERVAL_MS = 30;

/** `crypto.getRandomValues()` rejects views larger than 65536 bytes — fill in slices. */
const CRYPTO_RANDOM_CHUNK_BYTES = 65536;

// ── Pure helpers ─────────────────────────────────────────────────────────

/** `garbage.php`'s `ckSize` is MiB (2^20 bytes) — live-verified 2026-07-06. */
function toCkSize(bytes: number): number {
  return Math.max(1, Math.round(bytes / 1_048_576));
}

/** Adaptive next-request size targeting {@link TARGET_REQUEST_SECS} at `mbps`. */
function adaptiveChunkBytes(mbps: number, targetSecs: number, minBytes: number, maxBytes: number): number {
  if (!Number.isFinite(mbps) || mbps <= 0) return minBytes;
  const bytes = Math.round((mbps * 1_000_000 / 8) * targetSecs);
  return Math.min(maxBytes, Math.max(minBytes, bytes));
}

/**
 * A Blob of cryptographically random bytes with no MIME type set. Random
 * (not zero-filled — see file header) so no intermediary can compress it
 * away; the empty `type` keeps the upload POST a CORS "simple request".
 */
function randomBlob(bytes: number): Blob {
  const buf = new Uint8Array(bytes);
  for (let offset = 0; offset < bytes; offset += CRYPTO_RANDOM_CHUNK_BYTES) {
    const end = Math.min(offset + CRYPTO_RANDOM_CHUNK_BYTES, bytes);
    crypto.getRandomValues(buf.subarray(offset, end));
  }
  return new Blob([buf]);
}

/**
 * METHODOLOGY.md §5 steps 2-3 (everything except the bootstrap step, which
 * belongs to the orchestrator — see file header): plateau warm-up discard,
 * then (upload only) keep the fastest 50%, then IQR k=1.5.
 */
function cleanForDirection(raw: number[], isUpload: boolean): number[] {
  if (raw.length === 0) return [];
  const afterPlateau = raw.slice(plateauStart(raw));
  const preIqr = isUpload
    ? [...afterPlateau].sort((a, b) => b - a).slice(0, Math.ceil(afterPlateau.length / 2))
    : afterPlateau;
  return filterOutliersIQR(preIqr, 1.5);
}

// ── Provider ─────────────────────────────────────────────────────────────

export class LibreSpeedProvider implements SpeedTestProvider {
  name = 'LibreSpeed';
  supportsPacketLoss = false;
  requiresConsent = false;

  private aborted = false;
  private currentController: AbortController | null = null;

  /** fetch() with a hard timeout budget and a `stop()`-reachable controller. */
  private async fetchWithBudget(url: string, init: RequestInit, budgetMs: number): Promise<Response> {
    if (this.aborted) throw new Error('LibreSpeed: aborted');
    const controller = new AbortController();
    this.currentController = controller;
    const timer = setTimeout(() => controller.abort(), Math.max(MIN_REQUEST_TIMEOUT_MS, budgetMs));
    try {
      return await fetch(url, { ...init, mode: 'cors', cache: 'no-store', signal: controller.signal });
    } finally {
      clearTimeout(timer);
      if (this.currentController === controller) this.currentController = null;
    }
  }

  /** One GET round-trip to a backend's empty/black-hole endpoint; throws on any failure (network, CORS, non-2xx). */
  private async probeRtt(backend: LibreSpeedBackend, timeoutMs: number): Promise<number> {
    const url = `${backend.baseUrl}/${backend.ulPath}?cors=true&_t=${Date.now()}&_r=${Math.random()}`;
    const t0 = performance.now();
    const resp = await this.fetchWithBudget(url, { method: 'GET' }, timeoutMs);
    await resp.arrayBuffer().catch(() => undefined);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return performance.now() - t0;
  }

  /**
   * Try each candidate in order (both pins, then the fallback rotation).
   * The first backend that answers a CORS-readable 2xx wins; a backend that
   * throws (network error or a CORS-blocked fetch rejection) is skipped in
   * favor of the next candidate — this IS the runtime CORS-failure rotation
   * the task calls for.
   */
  private async selectBackend(): Promise<{ backend: LibreSpeedBackend; firstRtt: number } | null> {
    for (const backend of CANDIDATE_BACKENDS) {
      if (this.aborted) return null;
      try {
        for (let i = 0; i < SELECTION_WARMUP_PROBES; i++) {
          await this.probeRtt(backend, SELECTION_PROBE_TIMEOUT_MS);
        }
        const rtt = await this.probeRtt(backend, SELECTION_PROBE_TIMEOUT_MS);
        return { backend, firstRtt: rtt };
      } catch (err) {
        console.warn(`[LibreSpeed] Backend unreachable or CORS-blocked, trying next candidate: ${backend.name}`, err);
      }
    }
    return null;
  }

  async start(onProgress: (p: SpeedTestProgress) => void, duration: TestDuration = 'auto'): Promise<SpeedTestResult> {
    this.aborted = false;

    const seconds = duration === 'auto' ? 30 : (typeof duration === 'number' ? duration : 30);
    const dlSecs = seconds;
    const ulSecs = seconds;

    let currentPing: number | null = null;
    let currentJitter: number | null = null;
    let currentDlMbps: number | null = null;
    let currentUlMbps: number | null = null;
    let currentServerName: string | null = null;

    const emit = (phase: TestPhase, dlProgress: number, ulProgress: number) => {
      onProgress({
        phase,
        currentProvider: this.name,
        ping: currentPing,
        jitter: currentJitter,
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

    // ── Server discovery (pinned + fallback rotation, no live list fetch) ──
    const selection = await this.selectBackend();
    if (!selection) {
      // Graceful, honest failure: reject with a clear diagnostic so the
      // caller (today: aggregated-provider.ts's catch block; tomorrow: the
      // v4 orchestrator) can mark this provider `availability: 'failed'`
      // rather than fabricating a zero result. See report re: this design
      // choice — matches the existing Cloudflare/NDT7 reject-on-failure
      // convention rather than inventing a new resolve-with-sentinel shape.
      throw new Error(
        this.aborted
          ? 'LibreSpeed: stopped before a backend was selected'
          : `LibreSpeed: no reachable CORS-enabled backend (tried all ${CANDIDATE_BACKENDS.length} candidates — 2 pinned + ${FALLBACK_ROTATION_BACKENDS.length} fallback rotation)`,
      );
    }
    const { backend, firstRtt } = selection;
    currentServerName = backend.name;
    currentPing = firstRtt;
    console.log(`[LibreSpeed] Selected backend: ${backend.name} (${backend.baseUrl})`);
    emit('discovering', 0, 0);

    // ── Latency ──────────────────────────────────────────────────────────
    const rttSamples: number[] = [firstRtt];
    for (let i = 0; i < LATENCY_PROBE_COUNT; i++) {
      if (this.aborted) break;
      try {
        const rtt = await this.probeRtt(backend, SELECTION_PROBE_TIMEOUT_MS);
        rttSamples.push(rtt);
        currentPing = Math.min(...rttSamples);
        currentJitter = computeLatencyStats(rttSamples).jitter;
      } catch {
        // Skip a failed probe — don't pollute results.
      }
      emit('latency', 0, 0);
      if (LATENCY_PROBE_INTERVAL_MS > 0) {
        await new Promise((r) => setTimeout(r, LATENCY_PROBE_INTERVAL_MS));
      }
    }
    const latencyStats = rttSamples.length > 0 ? computeLatencyStats(rttSamples) : undefined;
    currentPing = latencyStats ? latencyStats.min : currentPing;
    currentJitter = latencyStats ? latencyStats.jitter : currentJitter;

    // ── Download ─────────────────────────────────────────────────────────
    emit('download', 0, 0);
    const dlSamples: number[] = [];
    let dlBytes = 0;
    let dlChunkBytes = DOWNLOAD_MIN_BYTES;
    const dlStart = performance.now();
    const dlDeadline = dlStart + dlSecs * 1000;

    while (performance.now() < dlDeadline && !this.aborted) {
      const ckSize = toCkSize(dlChunkBytes);
      const url = `${backend.baseUrl}/${backend.dlPath}?cors=true&ckSize=${ckSize}&_t=${Date.now()}&_r=${Math.random()}`;
      const budget = dlDeadline - performance.now();
      const reqStart = performance.now();
      try {
        const resp = await this.fetchWithBudget(url, { method: 'GET' }, budget);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = await resp.arrayBuffer();
        const reqSecs = (performance.now() - reqStart) / 1000;
        const reqBytes = buf.byteLength;
        dlBytes += reqBytes;
        if (reqSecs > 0 && reqBytes > 0) {
          const mbps = (reqBytes * 8) / (reqSecs * 1_000_000);
          dlSamples.push(mbps);
          currentDlMbps = mbps;
          dlChunkBytes = adaptiveChunkBytes(mbps, TARGET_REQUEST_SECS, DOWNLOAD_MIN_BYTES, DOWNLOAD_MAX_BYTES);
        }
      } catch (err) {
        if (this.aborted) break;
        console.warn('[LibreSpeed] Download request failed, re-warming chunk size:', err);
        dlChunkBytes = DOWNLOAD_MIN_BYTES; // Link state unknown after an error.
      }
      const elapsed = performance.now() - dlStart;
      emit('download', Math.min(100, (elapsed / (dlSecs * 1000)) * 100), 0);
    }
    const dlDurationS = (performance.now() - dlStart) / 1000;

    // ── Upload ───────────────────────────────────────────────────────────
    emit('upload', 100, 0);
    const ulSamples: number[] = [];
    let ulBytes = 0;
    let ulChunkBytes = Math.max(UPLOAD_MIN_BYTES, 1_000_000);
    let ulBlob = randomBlob(ulChunkBytes);
    const ulStart = performance.now();
    const ulDeadline = ulStart + ulSecs * 1000;
    const ulBaseUrl = `${backend.baseUrl}/${backend.ulPath}?cors=true`;

    while (performance.now() < ulDeadline && !this.aborted) {
      if (ulBlob.size !== ulChunkBytes) ulBlob = randomBlob(ulChunkBytes);
      const reqBytes = ulBlob.size;
      const budget = ulDeadline - performance.now();
      const reqStart = performance.now();
      try {
        const resp = await this.fetchWithBudget(
          `${ulBaseUrl}&_t=${Date.now()}&_r=${Math.random()}`,
          { method: 'POST', body: ulBlob },
          budget,
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        await resp.arrayBuffer().catch(() => undefined);
        const reqSecs = (performance.now() - reqStart) / 1000;
        ulBytes += reqBytes;
        if (reqSecs > 0) {
          const mbps = (reqBytes * 8) / (reqSecs * 1_000_000);
          ulSamples.push(mbps);
          currentUlMbps = mbps;
          ulChunkBytes = adaptiveChunkBytes(mbps, TARGET_REQUEST_SECS, UPLOAD_MIN_BYTES, UPLOAD_MAX_BYTES);
        }
      } catch (err) {
        if (this.aborted) break;
        console.warn('[LibreSpeed] Upload request failed, re-warming chunk size:', err);
        ulChunkBytes = UPLOAD_MIN_BYTES;
      }
      const elapsed = performance.now() - ulStart;
      emit('upload', 100, Math.min(100, (elapsed / (ulSecs * 1000)) * 100));
    }
    const ulDurationS = (performance.now() - ulStart) / 1000;

    // Honest failure: the backend was reachable (selection succeeded) but
    // neither direction produced a single usable sample. Reject rather than
    // resolve with fabricated zeros — never silently report 0 Mbps as if it
    // were measured (METHODOLOGY.md §7's "never fabricated" ethos, applied
    // here to throughput as well as packet loss).
    if (dlSamples.length === 0 && ulSamples.length === 0) {
      throw new Error(`LibreSpeed: connected to ${backend.name} but no successful transfers completed`);
    }

    // ── Point estimates (METHODOLOGY.md §5 steps 2-3-5, minus bootstrap) ──
    const dlCleaned = cleanForDirection(dlSamples, false);
    const ulCleaned = cleanForDirection(ulSamples, true);
    const downloadSpeed = dlCleaned.length > 0 ? modifiedTrimean(dlCleaned) : 0;
    const uploadSpeed = ulCleaned.length > 0 ? modifiedTrimean(ulCleaned) : 0;

    // Hodges-Lehmann cross-check (METHODOLOGY.md §5 step 6) — an internal
    // instability signal, not a headline field. Logged, and attached below
    // as an undeclared field for a future-typed orchestrator to pick up.
    const dlHL = dlCleaned.length > 0 ? hodgesLehmann(dlCleaned) : 0;
    const ulHL = ulCleaned.length > 0 ? hodgesLehmann(ulCleaned) : 0;
    const dlUnstable = downloadSpeed > 0 && Math.abs(dlHL - downloadSpeed) / downloadSpeed > 0.15;
    const ulUnstable = uploadSpeed > 0 && Math.abs(ulHL - uploadSpeed) / uploadSpeed > 0.15;
    if (dlUnstable || ulUnstable) {
      console.warn('[LibreSpeed] Hodges-Lehmann cross-check exceeded 15% — internal instability flag:', {
        download: { trimean: downloadSpeed, hodgesLehmann: dlHL, unstable: dlUnstable },
        upload: { trimean: uploadSpeed, hodgesLehmann: ulHL, unstable: ulUnstable },
      });
    }

    console.log('[LibreSpeed] Final:', {
      server: backend.name,
      download: downloadSpeed,
      upload: uploadSpeed,
      ping: currentPing,
      jitter: currentJitter,
      dlSamples: dlSamples.length,
      ulSamples: ulSamples.length,
    });

    return {
      provider: 'librespeed',
      ping: currentPing ?? 0,
      jitter: currentJitter ?? 0,
      downloadSpeed,
      uploadSpeed,
      packetLoss: null,
      serverName: backend.name,
      timestamp: Date.now(),
      latencyStats,
      // Extra fields beyond the current SpeedTestResult type — see the
      // handoff report for the exact additions an orchestrator would need
      // to consume these formally instead of via `as any`.
      bandwidthSamples: { download: dlSamples, upload: ulSamples },
      downloadBytes: dlBytes,
      uploadBytes: ulBytes,
      downloadDurationS: dlDurationS,
      uploadDurationS: ulDurationS,
      unstableFlag: { download: dlUnstable, upload: ulUnstable },
      hodgesLehmann: { download: dlHL, upload: ulHL },
    } as any;
  }

  stop() {
    this.aborted = true;
    this.currentController?.abort();
  }
}
