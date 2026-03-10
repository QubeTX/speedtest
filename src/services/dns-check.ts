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
] as const;

const PROBE_TIMEOUT_MS = 5000;

function createTimeoutSignal(ms: number): AbortSignal {
  if ('timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  // Fallback for Safari < 16
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
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

    return {
      domain,
      status: 'pass',
      totalMs: Math.round(elapsed),
    };
  } catch {
    const elapsed = performance.now() - start;

    return {
      domain,
      status: 'fail',
      totalMs: Math.round(elapsed),
    };
  } finally {
    // Clean up performance entries for this probe
    try {
      const entries = performance.getEntriesByName(url, 'resource');
      for (const entry of entries) {
        performance.clearResourceTimings?.();
      }
    } catch {
      // Ignore — not all browsers support this
    }
  }
}

function buildResult(probes: DnsProbeResult[]): DnsCheckResult {
  const passed = probes.filter(p => p.status === 'pass');
  const avgTotalMs = passed.length > 0
    ? Math.round(passed.reduce((sum, p) => sum + (p.totalMs ?? 0), 0) / passed.length)
    : null;

  return {
    probes,
    allPassed: passed.length === probes.length,
    avgTotalMs,
  };
}

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
