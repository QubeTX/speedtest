// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.
import type { SpeedTestResult } from '../types/speedtest';
import { latencyStatistics, estimateTrace } from './measurement-v5';
import contract from './measurement-contract-v5.json';
import guide from './methodology-guide-v5.json';

/** Preserve every recorded field and sample; redact credentials rather than truncating diagnostics. */
export function diagnosticJson(value: unknown): string {
  return JSON.stringify(value, (key, item: unknown) => {
    if (/^(authorization|cookie|set-cookie|password|secret|token|access[_-]?token|api[_-]?key|signature)$/i.test(key)) return '[redacted credential]';
    if (typeof item !== 'string') return item;
    return item.replace(/(?:https?|wss?):\/\/[^\s<>"']+/g, address => {
      try {
        const url = new URL(address);
        if (url.username) url.username = '[redacted]';
        if (url.password) url.password = '[redacted]';
        for (const name of [...url.searchParams.keys()]) {
          if (/token|key|auth|signature|credential|secret|password|policy/i.test(name)) url.searchParams.set(name, '[redacted]');
        }
        return url.toString();
      } catch { return address; }
    });
  }, 2);
}

export function fullDiagnosticRecord(result: unknown, context?: unknown): string {
  return ['Complete recorded diagnostics (JSON)',
    'All recorded fields and samples follow without truncation. Missing fields were not recorded; null does not mean zero. Endpoint credentials are redacted. Latency arrays contain successful probes in collection order, not timestamps; failures are counted separately. Counter time is milliseconds, bytes are decimal payload bytes, speed is Mbps, latency is milliseconds. Native diagnostics, when present, have their own collection times and must not be treated as simultaneous with throughput.',
    '```json', diagnosticJson({ reportSchema: 'speedqx-diagnostic-report/1', context: context ?? null, result }), '```'].join('\n');
}

export const HTTP_TIMING_DESCRIPTION = 'We time each web request from the moment it starts until the app has read the whole response. This includes work by your device and the server, plus connection setup when needed. Quiet and busy checks use the same server address. The test did not record which HTTP version was used or whether a connection was reused.';
export const COMPARISON_GUIDANCE = 'To find out where a slowdown might come from, repeat with the same device and test mode near your Wi-Fi router, then with an Ethernet cable if available. Keep other network activity similar and compare several runs. This test alone cannot locate the cause or measure Wi-Fi signal strength.';
export const DATA_ACCOUNTING_DESCRIPTION = 'Your data limit counts downloaded data and all upload data handed off for sending. Confirmed data counts downloads received and uploads confirmed by the receiving service. The gap can include unfinished uploads or data that was sent but not confirmed. It does not measure the extra data used to carry and secure each request; that extra data and other apps’ traffic are outside these totals.';

export function latencyRows(latency: SpeedTestResult['httpLatency']) {
  const idle = latency?.idle.length ? latencyStatistics(latency.idle).p50 : null;
  return (['idle', 'download', 'upload'] as const).map(kind => {
    const values = latency?.[kind] ?? [];
    const stats = values.length ? latencyStatistics(values) : null;
    return { kind, stats, count: values.length, limited: values.length < 20,
      delta: kind !== 'idle' && stats && idle !== null ? stats.p50 - idle : null,
      attempts: latency?.attempts[kind] ?? 0, failures: latency?.failures[kind] ?? 0 };
  });
}

export function latencySummary(latency: SpeedTestResult['httpLatency']): string {
  const loaded = latencyRows(latency).filter(row => row.delta !== null);
  if (!loaded.length) return 'Latency increase unavailable: an idle baseline and successful loaded probes are required.';
  const worst = loaded.reduce((a, b) => a.delta! >= b.delta! ? a : b);
  const coverage = loaded.length < 2 ? ' Only one load direction was measured.' : '';
  if (worst.delta! <= 0) return 'No median latency increase was observed in the measured load conditions.' + coverage;
  return `${worst.kind === 'upload' ? 'Upload' : 'Download'} activity added ${worst.delta!.toFixed(1)} ms to the typical web response.${coverage} Game and call response times may differ. This test cannot tell where the delay came from.`;
}

export function formatV5Result(result: Pick<SpeedTestResult, 'measurement' | 'providerSet' | 'httpLatency' | 'latencyStats' | 'warnings'>, context?: unknown): string {
  const m = result.measurement!;
  const rate = (n: number | null) => n === null ? 'Unavailable' : `${n.toFixed(1)} Mbps`;
  const lines = ['SpeedQX connection report', `Download speed: ${rate(m.download.sustainedMbps)}. Upload speed: ${rate(m.upload.sustainedMbps)}.`, latencySummary(result.httpLatency),
    'These speeds describe this device and the services tested. They do not prove the maximum speed of the internet connection. Web request failures are not a packet-loss measurement.',
    '', 'Measurement details · Methodology 5.0', `${result.providerSet === 'full' ? 'Deep' : 'Quick'} · ${m.stopReason}`];
  for (const direction of ['download', 'upload'] as const) {
    lines.push(`${direction === 'download' ? 'Download' : 'Upload'} sustained: ${rate(m[direction].sustainedMbps)}`);
    lines.push(`Highest repeatable throughput: ${m[direction].ceilingMbps === null ? 'Not established in this run' : rate(m[direction].ceilingMbps)}`);
    lines.push(`Primary sources: ${m.primaryProviders[direction].join(', ') || 'none qualifying'}`);
    const spread = m[direction].repeatability;
    if (spread) lines.push(`${m.primaryProviders[direction].length > 1 ? 'Provider spread' : 'Observed window range'}: ${rate(spread.lower)} – ${rate(spread.upper)}`);
  }
  lines.push(latencySummary(result.httpLatency));
  for (const row of latencyRows(result.httpLatency)) {
    lines.push(`${row.kind} HTTP latency: ${row.stats ? `${row.stats.p50.toFixed(1)} ms median; P95 ${row.stats.p95.toFixed(1)} ms; PDV ${row.stats.pdv.toFixed(1)} ms` : row.attempts ? 'Attempted, no successful probes' : 'Not measured'}${row.delta === null ? '' : `; ${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(1)} ms vs idle`}; ${row.count} successful samples${row.limited ? ' (limited tail sampling)' : ''}; probes failed ${row.failures}/${row.attempts}`);
  }
  lines.push('PDV jitter = empirical P95 minus median HTTP latency. Fewer than 20 successful probes are flagged as limited tail sampling; more samples do not guarantee a precise tail estimate.');
  if (result.httpLatency) lines.push(`HTTP reference: ${result.httpLatency.endpoint}. ${HTTP_TIMING_DESCRIPTION}`);
  for (const trace of m.traces) {
    const estimate = estimateTrace(trace);
    lines.push(`${trace.provider} ${trace.direction}: ${rate(estimate.sustainedMbps)}; ${trace.streams} streams; ${estimate.qualification}; ${estimate.samples} intervals after warm-up${estimate.repeatability ? `; observed window range ${rate(estimate.repeatability.lower)} – ${rate(estimate.repeatability.upper)}` : ''}; ended ${trace.stopReason}`);
  }
  lines.push(`Confirmed payload: ${(m.bytesTransferred / 1e6).toFixed(1)} MB; budget consumed ${(m.budgetBytes / 1e6).toFixed(1)} / ${(m.byteLimit / 1e6).toFixed(1)} MB; elapsed ${(m.elapsedMs / 1000).toFixed(1)} s`);
  lines.push(DATA_ACCOUNTING_DESCRIPTION);
  lines.push('Sustained = confirmed payload / measurement time after warm-up. Primary sources run sequentially; their median is the headline, not a sum of simultaneous sources. Highest repeatable throughput is an observed repeated window rate, not proven maximum connection capacity.');
  lines.push('Packet loss and TCP retransmission rate were not measured. HTTP probe failures are separate.');
  lines.push(COMPARISON_GUIDANCE);
  for (const warning of result.warnings ?? []) lines.push(`Notice: ${warning}`);
  lines.push('', fullDiagnosticRecord(result, context), '', 'Measurement rules and definitions', '```json', diagnosticJson({ contract, guide }), '```');
  return JSON.parse(diagnosticJson(lines.join('\n'))) as string;
}
