import { describe, expect, it } from 'vitest';
import { estimateTrace, summarizeTraces, type MeasurementTrace } from '../measurement-v5';
import fixtures from '../../../measurement-v5-fixtures.json';

describe('v5 recorded-counter replay', () => {
  for (const f of fixtures) it(f.name, () => {
    const result = estimateTrace(f.trace as MeasurementTrace);
    expect(result.sustainedMbps).toEqual(f.expected.sustainedMbps);
    expect(result.ceilingMbps).toEqual(f.expected.ceilingMbps);
    expect(result.qualification).toEqual(f.expected.qualification);
    expect(result.measuredBytes).toEqual(f.expected.measuredBytes);
    expect(result.measuredMs).toEqual(f.expected.measuredMs);
  });
  it('gives each primary network one vote and excludes supplementary providers', () => {
    const base = fixtures[0].trace as MeasurementTrace;
    const traces = [base, { ...base, provider: 'msak', points: base.points.map(p => ({ ...p, bytes: p.bytes * 2 })) },
      { ...base, provider: 'ndt7', points: base.points.map(p => ({ ...p, bytes: p.bytes * 100 })) }];
    expect(summarizeTraces(traces, 'download').estimate.sustainedMbps).toBe(90);
    expect(summarizeTraces(traces, 'download').providers).toEqual(['cloudflare', 'msak']);
    expect(summarizeTraces([traces[2]], 'download').estimate.sustainedMbps).toBeNull();
  });
  it('repeated MSAK sessions do not increase its network weight', () => {
    const base = fixtures[0].trace as MeasurementTrace;
    const msak = { ...base, provider: 'msak', points: base.points.map(p => ({ ...p, bytes: p.bytes * 2 })) };
    expect(summarizeTraces([base, msak, msak], 'download').estimate.sustainedMbps).toBe(90);
  });
  it('withholds a lower ceiling after repeated-session and primary-network aggregation', () => {
    const steady = fixtures[0].trace as MeasurementTrace;
    const shortHigh = fixtures[fixtures.length - 1].trace as MeasurementTrace;
    const repeated = summarizeTraces([steady, shortHigh], 'download').estimate;
    expect(repeated.sustainedMbps).toBe(100);
    expect(repeated.ceilingMbps).toBeNull();
    const networks = summarizeTraces([steady, { ...shortHigh, provider: 'msak' }], 'download').estimate;
    expect(networks.sustainedMbps).toBe(120);
    expect(networks.ceilingMbps).toBeNull();
  });
});
