// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.
import type { SpeedTestResult } from '../types/speedtest';
import { median } from './measurement-v5';

export function formatV5Result(result: Pick<SpeedTestResult, 'measurement' | 'providerSet' | 'httpLatency' | 'latencyStats' | 'warnings'>): string {
  const m = result.measurement!;
  const rate = (n: number | null) => n === null ? 'Unavailable' : `${n.toFixed(1)} Mbps`;
  const lines = ['SpeedQX · Methodology 5.0', `${result.providerSet === 'full' ? 'Deep' : 'Quick'} · ${m.stopReason}`];
  for (const direction of ['download', 'upload'] as const) {
    lines.push(`${direction === 'download' ? 'Download' : 'Upload'} sustained: ${rate(m[direction].sustainedMbps)}`);
    lines.push(`Estimated ceiling: ${rate(m[direction].ceilingMbps)}`);
    lines.push(`Primary sources: ${m.primaryProviders[direction].join(', ') || 'none qualifying'}`);
  }
  if (result.httpLatency) for (const kind of ['idle', 'download', 'upload'] as const) {
    const l = result.httpLatency;
    lines.push(`${kind} HTTP median RTT: ${l[kind].length ? `${median(l[kind]).toFixed(1)} ms` : 'Unavailable'}; probes failed ${l.failures[kind]}/${l.attempts[kind]}`);
  }
  lines.push(`Idle PDV jitter: ${result.latencyStats ? `${(result.latencyStats.p95 - result.latencyStats.p50).toFixed(1)} ms` : 'Unavailable'}`);
  lines.push(`Confirmed payload: ${(m.bytesTransferred / 1e6).toFixed(1)} MB; budget consumed ${(m.budgetBytes / 1e6).toFixed(1)} / ${(m.byteLimit / 1e6).toFixed(1)} MB; elapsed ${(m.elapsedMs / 1000).toFixed(1)} s`);
  lines.push('Sustained application throughput on this device and path. UDP loss and TCP retransmission rate unavailable.');
  for (const warning of result.warnings ?? []) lines.push(`Notice: ${warning}`);
  return lines.join('\n');
}
