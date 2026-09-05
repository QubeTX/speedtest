// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { estimateTrace, summarizeTraces, type MeasurementTrace } from '../src/services/measurement-v5';
import { plateauStart, filterOutliersIQR, modifiedTrimean } from '../src/services/statistics';

const root = process.cwd();
const rust = process.env.SPEEDQX_REPLAY ?? path.resolve(root, '../qube-network-diagnostics/target/debug/examples/v5-replay.exe');
const existing = JSON.parse(readFileSync('measurement-v5-fixtures.json', 'utf8'));
const records: { name: string; trace: MeasurementTrace; truth: number }[] = [];
let seed = 419;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
for (const scenario of ['fixed', 'asymmetric', 'alternating', 'stalls', 'ramp', 'correlated', 'irregular']) for (const direction of ['download', 'upload'] as const) {
  let bytes = 0, t = 0, previous = 60;
  const points = [{ t, bytes }];
  for (let i = 0; i < 36; i++) {
    const dt = scenario === 'irregular' && i >= 4 ? [250, 1000, 500, 750][i % 4] : 500;
    const rate = scenario === 'fixed' ? 60 : scenario === 'asymmetric' ? direction === 'upload' ? 8 : 120 : scenario === 'alternating' ? i % 2 ? 100 : 20 : scenario === 'stalls' ? i % 8 < 2 ? 0 : 60 : scenario === 'ramp' ? 10 + i * 3 : scenario === 'correlated' ? previous * .8 + (random() * 80 + 20) * .2 : [8, 100, 20, 40][i % 4];
    previous = rate; bytes += Math.round(rate * dt / .008); t += dt; points.push({ t, bytes });
  }
  // Independent reference integrates bytes and elapsed time after the explicit 2s warm-up.
  const boundary = points.findIndex(p => p.t >= 2000);
  const truth = (bytes - points[boundary].bytes) * .008 / (t - points[boundary].t);
  records.push({ name: `${scenario}-${direction}`, trace: { provider: 'cloudflare', endpoint: 'https://reference.invalid/test', direction, streams: 2, transport: 'https', accounting: direction === 'upload' ? 'completed-request' : 'received', warmupMs: 2000, points, stopReason: 'complete' }, truth });
}
const live = JSON.parse(readFileSync('evidence/v5/live-cloudflare.json', 'utf8'));
const netem = JSON.parse(gunzipSync(readFileSync('evidence/v5/netem-fresh-clients.json.gz')).toString('utf8'));
const recorded: MeasurementTrace[] = [...live.rows.flatMap((r: any) => r.measurement.traces), ...netem.outcomes.filter((r: any) => r.kind === 'v5-acquisition').map((r: any) => r.trace)];
const traces = [...recorded, ...existing.map((f: { trace: MeasurementTrace }) => f.trace), ...records.map(r => r.trace)];
const ts = { estimates: traces.map(estimateTrace), download: summarizeTraces(traces, 'download'), upload: summarizeTraces(traces, 'upload') };
const rs = JSON.parse(execFileSync(rust, [], { input: JSON.stringify(traces), encoding: 'utf8' }));
function compare(a: any, b: any, key = '') {
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a))) throw new Error(`Parity mismatch ${key}: ${a} / ${b}`); return; }
  if (a && typeof a === 'object' && b && typeof b === 'object') { if (Object.keys(a).sort().join() !== Object.keys(b).sort().join()) throw new Error(`Schema mismatch ${key}`); for (const k of Object.keys(a)) compare(a[k], b[k], `${key}.${k}`); return; }
  if (a !== b) throw new Error(`Parity mismatch ${key}: ${a} / ${b}`);
}
compare(ts, rs);
// Different evidence availability must not leave a lower ceiling at either aggregation level.
for (const provider of ['cloudflare', 'msak']) {
  const pair = [existing[0].trace, { ...existing.at(-1).trace, provider }];
  const expected = { estimates: pair.map(estimateTrace), download: summarizeTraces(pair, 'download'), upload: summarizeTraces(pair, 'upload') };
  compare(expected, JSON.parse(execFileSync(rust, [], { input: JSON.stringify(pair), encoding: 'utf8' })));
  if (expected.download.estimate.ceilingMbps !== null) throw new Error('Lower ceiling was not withheld');
}
for (const e of ts.estimates) if (e.ceilingMbps !== null && e.ceilingMbps < e.sustainedMbps!) throw new Error('Ceiling below sustained throughput');
const comparisons = records.map(({ name, trace, truth }) => {
  const raw = trace.points.slice(1).map((p, i) => (p.bytes - trace.points[i].bytes) * .008 / (p.t - trace.points[i].t));
  const after = raw.slice(plateauStart(raw));
  const selected = trace.direction === 'upload' ? [...after].sort((a, b) => b - a).slice(0, Math.ceil(after.length / 2)) : after;
  // Exact v4 per-provider point pipeline, without stochastic CI or cross-provider merge.
  const v4 = modifiedTrimean(filterOutliersIQR(selected, 1.5)), v5 = estimateTrace(trace).sustainedMbps!;
  return { name, truthMbps: truth, v4Mbps: v4, v5Mbps: v5, v4ErrorPct: Math.abs(v4 / truth - 1) * 100, v5ErrorPct: Math.abs(v5 / truth - 1) * 100 };
});
const report = { kind: 'deterministic-estimator-and-full-trace-parity', limitations: 'Synthetic counter truth validates arithmetic. Replaying recorded production and netem counters validates language agreement, not absolute acquisition accuracy. Transport and device acceptance are separate.', traces: traces.length, compared: 'Every estimate field, both primary aggregations, warnings, qualifications, ranges, ceilings and provider identities', comparisons, meanAbsoluteErrorPct: { v4: comparisons.reduce((n, c) => n + c.v4ErrorPct, 0) / comparisons.length, v5: comparisons.reduce((n, c) => n + c.v5ErrorPct, 0) / comparisons.length } };
mkdirSync('evidence/v5', { recursive: true });
writeFileSync('evidence/v5/deterministic-parity.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
