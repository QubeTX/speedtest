import SpeedTestEngine from '@cloudflare/speedtest';
import type { SpeedTestProvider, SpeedTestProgress, SpeedTestResult, TestDuration, BufferbloatResult, AimScores, JitterBreakdown } from '../types/speedtest';
import { computeLatencyStats, bufferbloatDelta, rpm as computeRpm } from './statistics';

/**
 * Short-lived TURN credentials for the packet-loss measurement, minted by the
 * SpeedQX edge function (Cloudflare Realtime TURN). Absolute URL so the same
 * endpoint works from speedqx.com, localhost dev, and the iOS app's WebView.
 */
const TURN_CREDS_API_URL = 'https://speedqx.com/api/turn-credentials';

/**
 * @cloudflare/speedtest reports packet loss as a 0–1 RATIO
 * (lostMessages/numMessagesSent); the spec (METHODOLOGY.md §7), the display
 * chain, and the tooltip grade bands all speak PERCENT. Convert at the
 * provider boundary — defensively, in case a future engine version returns
 * percent already (values > 1 pass through).
 */
function packetLossRatioToPercent(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  return value <= 1 ? value * 100 : value;
}

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
    { type: 'packetLoss' as const, numPackets: 1000, batchSize: 10, batchWaitTime: 10, responsesWaitTime: 3000 },
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
    { type: 'packetLoss' as const, numPackets: 1000, batchSize: 10, batchWaitTime: 10, responsesWaitTime: 3000 },
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

      // Build a unified byte-weight array across ALL bandwidth measurements
      // (DL + UL interleaved in measurement order). Both downloadProgress and
      // uploadProgress report the same overall value so the visible bar advances
      // smoothly even when measurement types alternate.
      const allByteSizes: number[] = [];
      for (const m of measurements) {
        if ((m.type === 'download' || m.type === 'upload') && 'bytes' in m && 'count' in m) {
          for (let i = 0; i < m.count; i++) allByteSizes.push(m.bytes);
        }
      }
      const totalAllBytes = allByteSizes.reduce((s, b) => s + b, 0);
      let allCount = 0;
      let allBytesTransferred = 0;
      let currentPhase = 'discovering';

      // Track last known good values from progress callbacks as fallback
      let lastPing: number | null = null;
      let lastJitter: number | null = null;
      let lastDlMbps: number | null = null;
      let lastUlMbps: number | null = null;
      let lastPacketLoss: number | null = null;

      let settled = false;

      // Stall watchdog: if the engine emits no results-change events for this
      // long mid-run, it is wedged — most often speed.cloudflare.com throttling
      // large download payloads per-IP (HTTP 429), which the engine retries
      // silently forever (observed as a frozen "Cloudflare download" phase on
      // mobile). Stop the engine and fail this provider; the aggregated run
      // isolates the failure and the other sources carry the result.
      const STALL_MS = 25_000;
      let stallTimer: ReturnType<typeof setTimeout> | null = null;
      const clearStall = () => {
        if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
      };
      const armStall = () => {
        clearStall();
        stallTimer = setTimeout(() => {
          if (settled) return;
          settled = true;
          try { this.engine?.pause?.(); } catch { /* best-effort */ }
          reject(new Error('cloudflare stalled — no progress for 25s (possibly rate-limited, HTTP 429)'));
        }, STALL_MS);
      };

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
        // Packet loss rides a Cloudflare Realtime TURN relay. The engine's built-in
        // public TURN server is deprecated (its creds endpoint already CORS-fails), so
        // short-lived credentials are minted by our edge function. Absolute URL on
        // purpose: the same endpoint serves speedqx.com, local dev, and the iOS app's
        // WebView. On any failure the engine degrades packet loss to unavailable.
        turnServerCredsApiUrl: TURN_CREDS_API_URL,
        // Explicit relay host as well — the creds-API parser also carries it (as
        // `server`), but pinning it here means no parser change can strand the
        // engine on its deprecated turn.speed.cloudflare.com default.
        turnServerUri: 'turn.cloudflare.com:3478',
      });

      const engine = this.engine;

      engine.onResultsChange = ({ type }: { type: string }) => {
        armStall(); // any event = engine alive; re-arm the stall watchdog
        const results = engine.results;

        if (type === 'latency') {
          currentPhase = 'latency';
        } else if (type === 'download') {
          currentPhase = 'download';
          if (allCount < allByteSizes.length) {
            allBytesTransferred += allByteSizes[allCount];
          }
          allCount++;
        } else if (type === 'upload') {
          currentPhase = 'upload';
          if (allCount < allByteSizes.length) {
            allBytesTransferred += allByteSizes[allCount];
          }
          allCount++;
        }

        const ping = results.getUnloadedLatency();
        const jitter = results.getUnloadedJitter();
        const dlBps = results.getDownloadBandwidth();
        const ulBps = results.getUploadBandwidth();
        const packetLoss = packetLossRatioToPercent(results.getPacketLoss());

        // Capture last known good values for fallback in onFinish
        if (ping !== undefined) lastPing = ping;
        if (jitter !== undefined) lastJitter = jitter;
        if (dlBps !== undefined) lastDlMbps = dlBps / 1e6;
        if (ulBps !== undefined) lastUlMbps = ulBps / 1e6;
        if (packetLoss !== null) lastPacketLoss = packetLoss;

        onProgress({
          phase: currentPhase as SpeedTestProgress['phase'],
          currentProvider: 'Cloudflare',
          ping: ping ?? null,
          jitter: jitter ?? null,
          downloadSpeed: dlBps !== undefined ? dlBps / 1e6 : null,
          uploadSpeed: ulBps !== undefined ? ulBps / 1e6 : null,
          packetLoss: packetLoss ?? null,
          downloadProgress: totalAllBytes > 0 ? (allBytesTransferred / totalAllBytes) * 100 : 0,
          uploadProgress: totalAllBytes > 0 ? (allBytesTransferred / totalAllBytes) * 100 : 0,
          serverName: 'Cloudflare Edge',
          error: null,
        });
      };

      engine.onFinish = (results) => {
        clearStall();
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
        // v4 responsiveness figure (60000 / P50 loaded RTT), exposed for the aggregator.
        let cfRpm: number | null = null;
        const unloadedLat = summary.latency ?? lastPing ?? 0;
        if (unloadedLat > 0 && (dlLoadedLatency || ulLoadedLatency)) {
          // Legacy v3 ratio secondary (kept for existing UI).
          const dlRatio = dlLoadedLatency && dlLoadedLatency > 0 ? dlLoadedLatency / unloadedLat : 1;
          const ulRatio = ulLoadedLatency && ulLoadedLatency > 0 ? ulLoadedLatency / unloadedLat : 1;

          // v4 canonical: delta-ms grade from raw loaded/idle latency points.
          const idleRtts = unloadedLatencyPoints.length > 0 ? unloadedLatencyPoints : [unloadedLat];
          const loadedPooled = [...dlLoadedLatencyPoints, ...ulLoadedLatencyPoints];
          const delta = bufferbloatDelta(idleRtts, loadedPooled);
          cfRpm = loadedPooled.length > 0 ? computeRpm(loadedPooled) : null;

          const idleStats = computeLatencyStats(idleRtts);
          const dlLoadedStats = computeLatencyStats(dlLoadedLatencyPoints);
          const ulLoadedStats = computeLatencyStats(ulLoadedLatencyPoints);

          bufferbloat = {
            unloadedLatency: latencyStats ?? computeLatencyStats(unloadedLat > 0 ? [unloadedLat] : []),
            downloadLoadedLatency: dlLoadedStats,
            uploadLoadedLatency: ulLoadedStats,
            // v4 delta-ms grade is the headline grade (superset of the v3 letters).
            grade: delta.grade,
            downloadRatio: dlRatio,
            uploadRatio: ulRatio,
            deltaMs: delta.deltaMs,
            ratio: delta.ratio,
            unloadedLatencyMs: idleStats.p50,
            loadedLatencyMs: { download: dlLoadedStats.p95, upload: ulLoadedStats.p95 },
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

        // Build per-direction jitter breakdown from loaded latency data
        const jitterBreakdown: JitterBreakdown = {
          idle: summary.jitter ?? lastJitter ?? 0,
          duringDownload: dlLoadedJitter ?? 0,
          duringUpload: ulLoadedJitter ?? 0,
        };

        resolve({
          provider: 'cloudflare',
          ping: summary.latency ?? lastPing ?? 0,
          jitter: summary.jitter ?? lastJitter ?? 0,
          downloadSpeed: dlMbps,
          uploadSpeed: ulMbps,
          packetLoss: packetLossRatioToPercent(summary.packetLoss) ?? lastPacketLoss ?? null,
          serverName: 'Cloudflare Edge',
          timestamp: Date.now(),
          latencyStats,
          bufferbloat,
          aimScores,
          jitterBreakdown,
          rpm: cfRpm ?? undefined,
          bandwidthSamples: { download: dlSamples, upload: ulSamples },
          // Raw loaded/unloaded latency point arrays (ms), exposed so the
          // aggregator can recompute the v4 bufferbloat delta / RPM headline
          // from Cloudflare's saturation probes (METHODOLOGY.md §7).
          unloadedLatencyPoints,
          loadedLatencyPoints: { download: dlLoadedLatencyPoints, upload: ulLoadedLatencyPoints },
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
            settled = true;
            clearStall();
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
      armStall();
    });
  }

  stop() {
    if (this.engine) {
      this.engine.pause();
      this.engine = null;
    }
  }
}
