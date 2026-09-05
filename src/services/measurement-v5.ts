// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.

/** Pure, portable measurement contract. No clocks, network, UI, or randomness. */
import contract from './measurement-contract-v5.json';
export const METHODOLOGY_VERSION = '5.0';
export const PROFILES = contract.profiles;
export const WARMUP_MS = contract.warmupMs;
export const MIN_MEASUREMENT_MS = contract.minimumMeasurementMs;
export type Direction = 'download' | 'upload';
export type StopReason = 'complete' | 'time-limit' | 'byte-limit' | 'cancelled' | 'background' | 'network-change' | 'failed';
export interface CounterPoint { t: number; bytes: number; valid?: boolean }
export interface MeasurementTrace {
  provider: string;
  endpoint: string;
  transport: 'https' | 'websocket';
  streams: number;
  direction: Direction;
  accounting: 'received' | 'server-received' | 'completed-request' | 'sender-drained';
  warmupMs: number;
  points: CounterPoint[];
  stopReason: StopReason;
  integrityError?: string;
  serverTcpMinRttMs?: number;
}
export interface DirectionEstimate {
  sustainedMbps: number | null;
  ceilingMbps: number | null;
  measuredBytes: number;
  measuredMs: number;
  samples: number;
  repeatability: { lower: number; upper: number } | null;
  qualification: 'measured' | 'provisional' | 'unavailable';
  warnings: string[];
}
export interface MeasurementSummary {
  download: DirectionEstimate;
  upload: DirectionEstimate;
  primaryProviders: { download: string[]; upload: string[] };
  traces: MeasurementTrace[];
  bytesTransferred: number;
  /** Payload received plus upload payload offered; conservative data-limit accounting. */
  budgetBytes: number;
  byteLimit: number;
  elapsedMs: number;
  stopReason: StopReason;
}
export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b), n = s.length;
  return n ? (n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
}

/** Linear-interpolated empirical percentiles; latency samples stay chronological. */
export function latencyStatistics(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (p: number) => { const i = (sorted.length - 1) * p, a = Math.floor(i); return sorted[a] + (sorted[Math.ceil(i)] - sorted[a]) * (i - a); };
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  let jitter = 0;
  for (let i = 1; i < samples.length; i++) jitter += (Math.abs(samples[i] - samples[i - 1]) - jitter) / 16;
  const p50 = percentile(0.5), p95 = percentile(0.95);
  return { samples: [...samples], p50, p75: percentile(0.75), p95, p99: percentile(0.99), min: sorted[0], max: sorted[sorted.length - 1], mean,
    stddev: Math.sqrt(samples.reduce((n, s) => n + (s - mean) ** 2, 0) / samples.length), jitter,
    jitterMad: median(samples.map(s => Math.abs(s - p50))), pdv: p95 - p50, jitterRfc3550: jitter };
}
function empty(warnings: string[] = []): DirectionEstimate {
  return { sustainedMbps: null, ceilingMbps: null, measuredBytes: 0, measuredMs: 0, samples: 0, repeatability: null, qualification: 'unavailable', warnings };
}

/** A lower repeated plateau cannot establish a ceiling for a higher sustained result. */
function withholdLowCeiling(out: DirectionEstimate): void {
  if (out.ceilingMbps !== null && out.sustainedMbps !== null && out.ceilingMbps < out.sustainedMbps) {
    out.ceilingMbps = null;
    out.warnings.push('No repeatable ceiling at or above sustained throughput');
  }
}

/** Counter resets invalidate a session; callers start a new trace for a new socket session.
 * Warm-up boundaries never interpolate bytes whose arrival time is unknown.
 * Real stalls remain in the denominator. Invalid/hidden intervals are excluded explicitly. */
export function estimateTrace(trace: MeasurementTrace): DirectionEstimate {
  const out = empty();
  if (trace.integrityError) return empty([trace.integrityError]);
  if (!Number.isFinite(trace.warmupMs) || trace.warmupMs < 0) return empty(['Invalid warm-up duration']);
  if (trace.points.length < 2) return out;
  const p = trace.points;
  if (trace.stopReason === 'failed' && p[p.length - 1].bytes === p[0].bytes) return empty(['No successful transfer']);
  if (p.some((x, i) => !Number.isFinite(x.t) || !Number.isSafeInteger(x.bytes) || x.t < 0 || x.bytes < 0 ||
    (i > 0 && (x.t <= p[i - 1].t || x.bytes < p[i - 1].bytes)))) return empty(['Invalid or reset measurement counters']);
  const intervals: { start: number; end: number; bytes: number; rate: number }[] = [];
  const cutoff = p[0].t + trace.warmupMs;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    if (a.t < cutoff) continue;
    if (a.valid === false || b.valid === false) { out.warnings.push('Interrupted intervals excluded'); continue; }
    const dt = b.t - a.t, bytes = b.bytes - a.bytes;
    intervals.push({ start: a.t, end: b.t, bytes, rate: bytes * 0.008 / dt });
    out.measuredBytes += bytes; out.measuredMs += dt;
  }
  out.samples = intervals.length;
  if (!out.measuredMs) return out;
  out.sustainedMbps = out.measuredBytes * 0.008 / out.measuredMs;
  out.qualification = out.measuredMs >= MIN_MEASUREMENT_MS && trace.accounting !== 'sender-drained' ? 'measured' : 'provisional';
  if (trace.accounting === 'sender-drained') out.warnings.push('Upload lacks receiver confirmation');
  const windows: { start: number; end: number; rate: number }[] = [];
  for (let i = 0; i < intervals.length; i++) {
    let bytes = 0;
    for (let j = i; j < intervals.length; j++) {
      if (j > i && intervals[j].start !== intervals[j - 1].end) break;
      bytes += intervals[j].bytes;
      const dt = intervals[j].end - intervals[i].start;
      if (dt >= 3_000) { windows.push({ start: intervals[i].start, end: intervals[j].end, rate: bytes * 0.008 / dt }); break; }
    }
  }
  const windowRates = windows.map(w => w.rate);
  // An observed window range, deliberately NOT a nominal statistical confidence interval.
  if (windowRates.length >= 2) out.repeatability = { lower: Math.min(...windowRates), upper: Math.max(...windowRates) };
  if (out.qualification === 'measured') for (let i = 0; i < windows.length; i++) for (let j = i + 1; j < windows.length; j++) {
    const a = windows[i], b = windows[j], hi = Math.max(a.rate, b.rate), lo = Math.min(a.rate, b.rate);
    if (a.end <= b.start && hi > 0 && (hi - lo) / hi <= 0.1) out.ceilingMbps = Math.max(out.ceilingMbps ?? 0, lo);
  }
  withholdLowCeiling(out);
  if (out.repeatability && out.sustainedMbps > 0 && (out.repeatability.upper - out.repeatability.lower) / out.sustainedMbps > 0.2) out.warnings.push('Throughput varied during measurement');
  if (windows.length >= 2) {
    const first = windows[0], last = windows[windows.length - 1];
    if (first.end <= last.start && last.rate > 0 && last.rate > first.rate * 1.2) out.warnings.push('Throughput was still increasing after warm-up');
  }
  if (trace.stopReason !== 'complete') out.warnings.push(`Measurement ended: ${trace.stopReason}`);
  out.warnings = [...new Set(out.warnings)];
  return out;
}

/** The two primary networks each get one vote. Supplementary tests cannot move the headline. */
export function summarizeTraces(traces: MeasurementTrace[], direction: Direction): { estimate: DirectionEstimate; providers: string[] } {
  const primary = ['cloudflare', 'msak'];
  const candidates = primary.map(provider => {
    const estimates = traces.filter(t => t.provider === provider && t.direction === direction).map(estimateTrace);
    const qualified = estimates.filter(e => e.qualification === 'measured');
    if (!qualified.length) return null;
    const out = empty();
    out.measuredBytes = qualified.reduce((n, e) => n + e.measuredBytes, 0);
    out.measuredMs = qualified.reduce((n, e) => n + e.measuredMs, 0);
    out.samples = qualified.reduce((n, e) => n + e.samples, 0);
    out.sustainedMbps = out.measuredBytes * 0.008 / out.measuredMs;
    out.qualification = 'measured';
    const ceilings = qualified.flatMap(e => e.ceilingMbps === null ? [] : [e.ceilingMbps]);
    out.ceilingMbps = ceilings.length ? median(ceilings) : null;
    out.warnings = qualified.flatMap(e => e.warnings);
    withholdLowCeiling(out);
    const ranges = qualified.flatMap(e => e.repeatability ? [e.repeatability] : []);
    out.repeatability = ranges.length ? { lower: Math.min(...ranges.map(r => r.lower)), upper: Math.max(...ranges.map(r => r.upper)) } : null;
    return { provider, out };
  }).filter((x): x is { provider: string; out: DirectionEstimate } => x !== null);
  if (!candidates.length) return { estimate: empty(['No qualifying primary measurement']), providers: [] };
  const estimates = candidates.map(c => c.out), rates = estimates.map(e => e.sustainedMbps!);
  const out = empty(estimates.flatMap(e => e.warnings));
  out.sustainedMbps = median(rates); out.qualification = 'measured';
  out.measuredBytes = estimates.reduce((n, e) => n + e.measuredBytes, 0);
  out.measuredMs = estimates.reduce((n, e) => n + e.measuredMs, 0);
  out.samples = estimates.reduce((n, e) => n + e.samples, 0);
  out.repeatability = rates.length > 1 ? { lower: Math.min(...rates), upper: Math.max(...rates) } : estimates[0].repeatability;
  const ceilings = estimates.flatMap(e => e.ceilingMbps === null ? [] : [e.ceilingMbps]);
  if (ceilings.length && Math.max(...ceilings) - Math.min(...ceilings) <= 0.2 * Math.max(...ceilings)) out.ceilingMbps = median(ceilings);
  else if (ceilings.length) out.warnings.push('Ceiling estimates disagree across providers');
  withholdLowCeiling(out);
  if (rates.length === 1) out.warnings.push('Single primary source');
  else if (Math.max(...rates) - Math.min(...rates) > 0.2 * Math.max(...rates)) out.warnings.push('Primary providers disagree');
  out.warnings = [...new Set(out.warnings)];
  return { estimate: out, providers: candidates.map(c => c.provider) };
}
