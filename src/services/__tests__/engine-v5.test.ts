// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeasurementTrace } from '../measurement-v5';
import type { SpeedTestProgress } from '../../types/speedtest';

const transport = vi.hoisted(() => ({ calls: [] as { provider: string; direction: string; duration: number }[], locate: vi.fn(), after: undefined as (() => void) | undefined }));
vi.mock('../acquisition-v5', async importOriginal => {
  const actual = await importOriginal<typeof import('../acquisition-v5')>();
  const transfer = async (provider: string, endpoint: string, direction: 'download' | 'upload', duration: number, budget: InstanceType<typeof actual.RunBudget>, live: (rate: number, pct: number, bytes: number) => void) => {
    transport.calls.push({ provider, direction, duration });
    // Independent source speeds make accidental NDT7/supplementary inclusion visible.
    const rate = provider === 'cloudflare' ? 20 : provider === 'msak' ? 40 : 500;
    const points = Array.from({ length: 21 }, (_, i) => ({ t: i * 500, bytes: rate * i * 500 / .008 }));
    budget.consume(points[points.length - 1].bytes); live(rate, 100, points[points.length - 1].bytes);
    transport.after?.();
    const trace: MeasurementTrace = { provider, endpoint, direction, streams: provider === 'ndt7' ? 1 : 2, transport: provider === 'cloudflare' ? 'https' : 'websocket', accounting: direction === 'download' ? 'received' : 'server-received', warmupMs: 2000, points, stopReason: budget.reason };
    return { trace };
  };
  return { ...actual, httpTransfer: transfer, websocketTransfer: transfer, locateMlab: transport.locate,
    locateSupplementary: async (key: string) => ({ machine: key, download: `https://${key}.example/download`, ...(key === 'librespeed' ? { upload: `https://${key}.example/upload` } : {}) }) };
});
import { V5Provider } from '../engine-v5';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('navigator', {});
  vi.stubGlobal('fetch', async () => { await new Promise(resolve => setTimeout(resolve, 10)); return new Response(null); });
  transport.calls = []; transport.after = undefined;
  transport.locate.mockReset().mockImplementation(async (key: string) => ({ machine: key, download: `wss://${key}.example/download`, upload: `wss://${key}.example/upload` }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('bounded common run schedules', () => {
  it('defaults to Quick and respects declined M-Lab publication consent', async () => {
    const pending = new V5Provider().start(() => {}); await vi.runAllTimersAsync(); const result = await pending;
    expect(transport.locate).not.toHaveBeenCalled();
    expect(transport.calls.map(c => [c.provider, c.direction, c.duration])).toEqual([['cloudflare', 'download', 10000], ['cloudflare', 'upload', 10000]]);
    expect(result.measurement!.download.sustainedMbps).toBe(20);
    expect(result.measurement!.primaryProviders.download).toHaveLength(1);
    expect(result.httpLatency!.idle).toHaveLength(12);
    expect(result.measurement!.stopReason).toBe('complete');
  });
  it('repeats primary networks in Deep, reuses discovery, and keeps supporting sources outside the median', async () => {
    const progress: SpeedTestProgress[] = [];
    const pending = new V5Provider({ profile: 'full', consent: true }).start(p => progress.push(p));
    await vi.runAllTimersAsync(); const result = await pending;
    expect(transport.locate.mock.calls.map(c => c[0])).toEqual(['msak', 'ndt7']);
    expect(transport.calls.filter(c => c.provider === 'cloudflare' || c.provider === 'msak')).toHaveLength(8);
    expect(transport.calls.filter(c => c.provider === 'cloudflare' || c.provider === 'msak').every(c => c.duration === 20000)).toBe(true);
    expect(result.measurement!.download.sustainedMbps).toBe(30);
    expect(result.measurement!.upload.sustainedMbps).toBe(30);
    expect(result.measurement!.primaryProviders.download).toHaveLength(2);
    expect(progress[progress.length - 1].runData!.confirmedBytes).toBe(result.measurement!.bytesTransferred);
  });
  it('keeps a cancelled download and never starts the next direction or provider', async () => {
    const engine = new V5Provider({ consent: true }); transport.after = () => engine.stop();
    const pending = engine.start(() => {}); await vi.runAllTimersAsync(); const result = await pending;
    expect(transport.calls).toHaveLength(1); expect(transport.locate).not.toHaveBeenCalled();
    expect(result.measurement!.download.sustainedMbps).toBe(20);
    expect(result.measurement!.upload.sustainedMbps).toBeNull();
    expect(result.measurement!.stopReason).toBe('cancelled');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not retry M-Lab discovery after a rate-limit response', async () => {
    transport.locate.mockRejectedValue(new Error('M-Lab discovery HTTP 429'));
    const pending = new V5Provider({ profile: 'full', consent: true }).start(() => {});
    await vi.runAllTimersAsync(); const result = await pending;
    expect(transport.locate).toHaveBeenCalledOnce();
    expect(result.measurement!.download.sustainedMbps).toBe(20);
    expect(result.warnings).toContain('M-Lab NDT7 · single stream skipped after M-Lab rate limit');
  });
});
