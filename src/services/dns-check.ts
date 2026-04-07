import type { DnsProbeResult, DnsCheckResult } from '../types/speedtest';

const DNS_PROBE_DOMAINS = [
  'google.com',
  'cloudflare.com',
  'apple.com',
  'microsoft.com',
  'amazon.com',
  'netflix.com',
  'github.com',
  'wikipedia.org',
  'facebook.com',
  'twitter.com',
  'youtube.com',
  'reddit.com',
] as const;

const PROBE_TIMEOUT_MS = 5000;

/** Delay between first and second pass in dual-pass mode (ms). */
const DUAL_PASS_DELAY_MS = 500;

export interface DualPassDnsCheckResult {
  firstPass: DnsCheckResult;
  secondPass: DnsCheckResult;
  /** Difference in average totalMs between passes (firstPass - secondPass). Positive = cache warming helped. */
  cachingEffect: number | null;
}

function createTimeoutSignal(ms: number): AbortSignal {
  if ('timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  // Fallback for Safari < 16
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/**
 * Extract granular timing breakdown from the Performance Resource Timing API.
 * Returns null values for fields that are zeroed out (common with no-cors / Timing-Allow-Origin restrictions).
 */
function extractResourceTiming(url: string): {
  dnsMs: number | null;
  tcpMs: number | null;
  tlsMs: number | null;
  ttfbMs: number | null;
} {
  try {
    const entries = performance.getEntriesByName(url, 'resource') as PerformanceResourceTiming[];
    if (entries.length === 0) {
      return { dnsMs: null, tcpMs: null, tlsMs: null, ttfbMs: null };
    }

    // Use the most recent entry
    const entry = entries[entries.length - 1];

    const dnsMs = entry.domainLookupEnd - entry.domainLookupStart;
    const tcpMs = entry.connectEnd - entry.connectStart;
    const tlsMs = entry.secureConnectionStart > 0
      ? entry.connectEnd - entry.secureConnectionStart
      : 0;
    const ttfbMs = entry.responseStart - entry.requestStart;

    // If all timing fields are zero, the browser restricted them (Timing-Allow-Origin).
    // Fall back to null for all granular fields.
    const allZero = dnsMs === 0 && tcpMs === 0 && tlsMs === 0 && ttfbMs === 0;

    if (allZero) {
      return { dnsMs: null, tcpMs: null, tlsMs: null, ttfbMs: null };
    }

    return {
      dnsMs: Math.round(dnsMs * 100) / 100,
      tcpMs: Math.round(tcpMs * 100) / 100,
      tlsMs: tlsMs > 0 ? Math.round(tlsMs * 100) / 100 : null,
      ttfbMs: Math.round(ttfbMs * 100) / 100,
    };
  } catch {
    return { dnsMs: null, tcpMs: null, tlsMs: null, ttfbMs: null };
  }
}

async function probeDomain(domain: string): Promise<DnsProbeResult> {
  const url = `https://${domain}/favicon.ico?_dns_t=${Date.now()}`;
  const start = performance.now();

  try {
    await fetch(url, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: createTimeoutSignal(PROBE_TIMEOUT_MS),
    });
    const elapsed = performance.now() - start;
    const timing = extractResourceTiming(url);

    return {
      domain,
      status: 'pass',
      dnsMs: timing.dnsMs,
      tcpMs: timing.tcpMs,
      tlsMs: timing.tlsMs,
      ttfbMs: timing.ttfbMs,
      totalMs: Math.round(elapsed),
    };
  } catch {
    const elapsed = performance.now() - start;
    const timing = extractResourceTiming(url);

    return {
      domain,
      status: 'fail',
      dnsMs: timing.dnsMs,
      tcpMs: timing.tcpMs,
      tlsMs: timing.tlsMs,
      ttfbMs: timing.ttfbMs,
      totalMs: Math.round(elapsed),
    };
  } finally {
    // Clean up performance entries for this probe
    try {
      performance.clearResourceTimings?.();
    } catch {
      // Ignore -- not all browsers support this
    }
  }
}

/** Compute the average of non-null values from an array, or null if no valid values exist. */
function avgOf(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((sum, v) => sum + v, 0) / valid.length) * 100) / 100;
}

function buildResult(probes: DnsProbeResult[]): DnsCheckResult {
  const passed = probes.filter(p => p.status === 'pass');

  return {
    probes,
    allPassed: passed.length === probes.length,
    avgTotalMs: avgOf(passed.map(p => p.totalMs)),
    avgDnsMs: avgOf(passed.map(p => p.dnsMs)),
    avgTcpMs: avgOf(passed.map(p => p.tcpMs)),
    avgTlsMs: avgOf(passed.map(p => p.tlsMs)),
    avgTtfbMs: avgOf(passed.map(p => p.ttfbMs)),
  };
}

/**
 * Run a single pass of DNS probes across all 12 domains in parallel.
 * Calls `onUpdate` as each probe completes (with results in domain order).
 */
export async function runDnsCheck(
  onUpdate?: (partial: DnsCheckResult) => void,
): Promise<DnsCheckResult> {
  const completed: DnsProbeResult[] = [];

  // Create all probe promises, calling onUpdate as each settles
  const probePromises = DNS_PROBE_DOMAINS.map(async (domain) => {
    const result = await probeDomain(domain);
    completed.push(result);
    // Maintain consistent domain order in updates
    const ordered = DNS_PROBE_DOMAINS
      .map(d => completed.find(c => c.domain === d))
      .filter((r): r is DnsProbeResult => r !== undefined);
    onUpdate?.(buildResult(ordered));
    return result;
  });

  await Promise.allSettled(probePromises);

  // Final result in domain order
  const orderedResults = DNS_PROBE_DOMAINS.map(
    d => completed.find(c => c.domain === d)!,
  );

  return buildResult(orderedResults);
}

/**
 * Run two passes of DNS probes with a brief delay between them.
 * Returns both pass results plus a `cachingEffect` metric showing the
 * difference in average totalMs (firstPass - secondPass). A positive value
 * indicates DNS cache warming improved performance on the second pass.
 */
export async function runDualPassDnsCheck(
  onUpdate?: (pass: 1 | 2, partial: DnsCheckResult) => void,
): Promise<DualPassDnsCheckResult> {
  // First pass
  const firstPass = await runDnsCheck(
    onUpdate ? (partial) => onUpdate(1, partial) : undefined,
  );

  // Brief delay to let caches settle
  await new Promise(resolve => setTimeout(resolve, DUAL_PASS_DELAY_MS));

  // Second pass
  const secondPass = await runDnsCheck(
    onUpdate ? (partial) => onUpdate(2, partial) : undefined,
  );

  // Compute caching effect: positive means second pass was faster (cache helped)
  const cachingEffect =
    firstPass.avgTotalMs !== null && secondPass.avgTotalMs !== null
      ? Math.round((firstPass.avgTotalMs - secondPass.avgTotalMs) * 100) / 100
      : null;

  return { firstPass, secondPass, cachingEffect };
}
