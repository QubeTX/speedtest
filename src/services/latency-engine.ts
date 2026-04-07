/**
 * Dedicated latency measurement engine.
 *
 * Sends HTTP HEAD-style requests (zero-byte downloads) to Cloudflare's edge
 * and computes comprehensive latency statistics including percentiles,
 * RFC 3550 jitter, and standard deviation.
 *
 * Used for:
 * - Unloaded latency (idle phase, before bandwidth tests)
 * - Loaded latency (concurrent with download/upload for bufferbloat detection)
 */

import { computeLatencyStats, type LatencyStatsResult } from './statistics';

const LATENCY_ENDPOINT = 'https://speed.cloudflare.com/__down?bytes=0';

export interface LatencyEngineOptions {
  /** Number of ping samples to collect. Default: 100 */
  sampleCount?: number;
  /** Delay between pings in ms. Default: 50 */
  intervalMs?: number;
  /** Abort signal to cancel measurement. */
  signal?: AbortSignal;
  /** Callback fired after each sample with running stats. */
  onSample?: (stats: LatencyStatsResult, sampleIndex: number) => void;
}

/**
 * Measure a single HTTP RTT to the Cloudflare edge.
 * Uses PerformanceResourceTiming for precise timing when available,
 * falling back to performance.now() deltas.
 */
async function measurePing(signal?: AbortSignal): Promise<number> {
  const cacheBust = `${LATENCY_ENDPOINT}&_t=${Date.now()}&_r=${Math.random()}`;

  const t0 = performance.now();
  await fetch(cacheBust, {
    mode: 'cors',
    cache: 'no-store',
    signal,
  });
  const fallbackRtt = performance.now() - t0;

  // Try PerformanceResourceTiming for more accurate TTFB
  try {
    const entries = performance.getEntriesByName(cacheBust, 'resource') as PerformanceResourceTiming[];
    if (entries.length > 0) {
      const entry = entries[entries.length - 1];
      // responseStart - requestStart gives us the closest to network RTT
      // (excludes DNS, TCP, TLS if connection is reused)
      const rtt = entry.responseStart - entry.requestStart;
      if (rtt > 0 && rtt < fallbackRtt * 3) {
        performance.clearResourceTimings();
        return rtt;
      }
    }
  } catch {
    // PerformanceResourceTiming not available
  }

  try { performance.clearResourceTimings(); } catch { /* noop */ }
  return fallbackRtt;
}

/**
 * Run the full latency measurement phase.
 * Collects `sampleCount` pings and returns comprehensive statistics.
 */
export async function measureLatency(options: LatencyEngineOptions = {}): Promise<LatencyStatsResult> {
  const {
    sampleCount = 100,
    intervalMs = 50,
    signal,
    onSample,
  } = options;

  const samples: number[] = [];

  // Warm-up: 3 pings to establish connection (DNS + TCP + TLS),
  // results discarded
  for (let i = 0; i < 3; i++) {
    if (signal?.aborted) break;
    try {
      await measurePing(signal);
    } catch {
      // Ignore warm-up failures
    }
  }

  for (let i = 0; i < sampleCount; i++) {
    if (signal?.aborted) break;

    // Pause measurement if tab is backgrounded (browsers throttle background tabs,
    // which would produce inflated RTT values)
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      await new Promise<void>(resolve => {
        const handler = () => {
          if (document.visibilityState === 'visible') {
            document.removeEventListener('visibilitychange', handler);
            resolve();
          }
        };
        document.addEventListener('visibilitychange', handler);
      });
      if (signal?.aborted) break;
    }

    try {
      const rtt = await measurePing(signal);
      samples.push(rtt);

      if (onSample) {
        onSample(computeLatencyStats(samples), i);
      }
    } catch {
      // Skip failed pings — don't pollute results
    }

    // Small delay between pings to avoid overwhelming the connection
    if (intervalMs > 0 && i < sampleCount - 1) {
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }

  return computeLatencyStats(samples);
}

/**
 * Run concurrent latency probes during a bandwidth test (loaded latency).
 * Returns an abort function. Collected samples are returned via onComplete.
 */
export function startLoadedLatencyProbes(options: {
  intervalMs?: number;
  onSample?: (stats: LatencyStatsResult) => void;
}): { stop: () => Promise<LatencyStatsResult>; } {
  const { intervalMs = 400, onSample } = options;
  const controller = new AbortController();
  const samples: number[] = [];
  let running = true;

  const loop = (async () => {
    while (running && !controller.signal.aborted) {
      try {
        const rtt = await measurePing(controller.signal);
        samples.push(rtt);
        if (onSample) {
          onSample(computeLatencyStats(samples));
        }
      } catch {
        // Skip on abort or network error
      }
      if (running && !controller.signal.aborted && intervalMs > 0) {
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }
  })();

  return {
    async stop() {
      running = false;
      controller.abort();
      try { await loop; } catch { /* absorb */ }
      return computeLatencyStats(samples);
    },
  };
}
