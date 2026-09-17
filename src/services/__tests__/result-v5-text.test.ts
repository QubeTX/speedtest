// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.
import { describe, it, expect } from 'vitest';
import { latencyRows, latencySummary, fullDiagnosticRecord, diagnosticJson } from '../result-v5-text';

const latency = { endpoint: 'https://speed.cloudflare.com/__down?bytes=0', idle: [57.5], download: [102.5], upload: [152.5], attempts: { idle: 1, download: 1, upload: 1 }, failures: { idle: 0, download: 0, upload: 0 } };
describe('complete diagnostic report', () => {
  it('reports measured increases without inventing an idle baseline', () => {
    expect(latencyRows(latency).map(row => row.delta)).toEqual([null, 45, 95]);
    expect(latencySummary(latency)).toContain('Upload activity added 95.0 ms');
    expect(latencyRows({ ...latency, idle: [] })[1].delta).toBeNull();
    expect(latencySummary({ ...latency, idle: [] })).toContain('unavailable');
    expect(latencyRows(latency)[0].limited).toBe(true);
  });
  it('retains negative deltas and discloses missing directions', () => {
    expect(latencySummary({ ...latency, download: [10], upload: [] })).toContain('No median latency increase');
    expect(latencySummary({ ...latency, download: [] })).toContain('Only one load direction');
    expect(latencyRows({ ...latency, upload: [0] })[2].delta).toBe(-57.5);
  });
  it('preserves every nested field and all samples without truncation', () => {
    const record = { httpLatency: latency, measurement: { points: Array.from({ length: 2500 }, (_, t) => ({ t, bytes: t * 123, valid: t !== 7 })) }, providerPreflight: { native: { path: 'wifi', dns: [{ ttl: 13, addresses: ['192.0.2.1'] }] } }, unknownFutureField: { zero: 0, absent: null } };
    const report = fullDiagnosticRecord(record);
    const parsed = JSON.parse(report.split('```json\n')[1].split('\n```')[0]);
    expect(parsed.result).toEqual(record);
  });
  it('redacts credentials without removing endpoint and timing evidence', () => {
    const result = JSON.parse(diagnosticJson({ endpoint: 'wss://test.example/ndt?access_token=secret&duration=10', token: 'secret', duration: 10, note: 'Failed https://example.test/?key=secret&bytes=50' }));
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(result.endpoint).toContain('duration=10');
    expect(result.duration).toBe(10);
    expect(result.note).toContain('bytes=50');
  });
});
