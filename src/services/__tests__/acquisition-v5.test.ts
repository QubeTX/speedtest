// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { endpointLabel, RunBudget, httpTransfer, locateMlab, websocketTransfer } from '../acquisition-v5';
import { estimateTrace } from '../measurement-v5';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('run resource ownership', () => {
  it('reserves across concurrent lanes without granting the same bytes twice', () => {
    const budget = new RunBudget(1000, 90000);
    expect(budget.reserve(700)).toBe(700); expect(budget.reserve(700)).toBe(300);
    expect(budget.reserve(1)).toBe(0); expect(budget.signal.aborted).toBe(false);
    budget.consume(500, 500); budget.release(200);
    expect(budget.reserve(1000)).toBe(200);
    budget.consume(500, 500); expect(budget.reason).toBe('byte-limit'); expect(budget.signal.aborted).toBe(true); budget.dispose();
  });
  it('cancellation closes connecting sockets and retains the first stop reason', () => {
    const budget = new RunBudget(1000, 90000), close = vi.fn();
    budget.sockets.add({ close } as unknown as WebSocket); budget.stop('cancelled'); budget.stop('byte-limit');
    expect(close).toHaveBeenCalledOnce(); expect(budget.reason).toBe('cancelled'); expect(budget.reserve(1)).toBe(0); budget.dispose();
  });
  it('enforces the overall deadline independently of provider activity', async () => {
    vi.useFakeTimers(); const budget = new RunBudget(1000, 90_000);
    await vi.advanceTimersByTimeAsync(90_000); expect(budget.reason).toBe('time-limit'); budget.dispose();
  });
  it('removes signed discovery query parameters from exported provenance', () => {
    expect(endpointLabel('wss://example.org/ndt/v7/upload?token=secret')).toBe('wss://example.org/ndt/v7/upload');
  });
  it('does not retry a provider refusal', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 429 })); vi.stubGlobal('fetch', fetcher);
    const budget = new RunBudget(100_000_000, 90000);
    const output = await httpTransfer('cloudflare', 'https://example.org/download', 'download', 10000, budget, () => {}, 1);
    expect(output.trace.stopReason).toBe('failed'); expect(fetcher).toHaveBeenCalledOnce(); expect(budget.used).toBe(0); budget.dispose();
  });
  it('bounds discovery even when a fetch never responds', async () => {
    vi.useFakeTimers(); vi.stubGlobal('fetch', (_url: string, options: RequestInit) => new Promise((_resolve, reject) => options.signal!.addEventListener('abort', () => reject(new Error('aborted')))));
    const budget = new RunBudget(1000, 90000), pending = locateMlab('msak', 10000, budget);
    const assertion = expect(pending).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(8000); await assertion; expect(budget.signal.aborted).toBe(false); budget.dispose();
  });
  it('bounds upload growth when the first acknowledgements arrive implausibly quickly', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
    const sizes: number[] = [];
    const budget = new RunBudget(500_000_000, 90_000);
    vi.stubGlobal('fetch', async (_url: URL, request: RequestInit) => {
      sizes.push((request.body as Uint8Array).byteLength);
      await new Promise(resolve => setTimeout(resolve, 1));
      if (sizes.length === 10) budget.stop('cancelled');
      return new Response(null, { status: 200 });
    });
    const pending = httpTransfer('cloudflare', 'https://reference.example/upload', 'upload', 10000, budget, () => {}, 1);
    await vi.advanceTimersByTimeAsync(15); await pending;
    expect(sizes[0]).toBe(1024);
    expect(sizes.length).toBe(10);
    expect(sizes.every((size, i) => i === 0 || size <= sizes[i - 1] * 2)).toBe(true);
    budget.dispose();
  });
});

class TestSocket {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 1;
  bufferedAmount = 2_000_000;
  binaryType = '';
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.onclose?.(); });
  constructor() { TestSocket.instances.push(this); }
  message(value: unknown) { this.onmessage?.({ data: value instanceof ArrayBuffer ? value : JSON.stringify(value) }); }
}

describe('receiver-accounted socket acquisition', () => {
  function setup() {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
    TestSocket.instances = []; vi.stubGlobal('WebSocket', TestSocket);
    const budget = new RunBudget(500_000_000, 90_000);
    return budget;
  }
  it('keeps genuine stalls and the partial last interval in download counters', async () => {
    const budget = setup();
    const pending = websocketTransfer('ndt7', 'wss://reference.example/ndt', 'download', 10_000, budget, () => {});
    const socket = TestSocket.instances[0];
    for (let i = 0; i < 15; i++) {
      if (i !== 8) socket.message(new ArrayBuffer(125_000));
      await vi.advanceTimersByTimeAsync(500);
    }
    await vi.advanceTimersByTimeAsync(123); budget.stop('cancelled');
    const { trace } = await pending;
    expect(trace.points[trace.points.length - 1]?.t).toBe(7623);
    expect(trace.points[trace.points.length - 1]?.bytes).toBe(14 * 125_000);
    expect(trace.points.some((p, i) => i > 0 && p.bytes === trace.points[i - 1].bytes)).toBe(true);
    expect(estimateTrace(trace).measuredMs).toBe(5623);
    expect(trace.stopReason).toBe('cancelled'); expect(socket.close).toHaveBeenCalled(); expect(budget.sockets.size).toBe(0); budget.dispose();
  });
  it('uses only server acknowledgements, independently for both MSAK streams', async () => {
    const budget = setup();
    const pending = websocketTransfer('msak', 'wss://reference.example/throughput', 'upload', 10_000, budget, () => {});
    for (let i = 1; i <= 16; i++) {
      TestSocket.instances.forEach(socket => socket.message({ Application: { BytesReceived: i * 125_000 }, TCPInfo: { MinRTT: 12000 } }));
      await vi.advanceTimersByTimeAsync(500);
    }
    budget.stop('cancelled'); const { trace } = await pending;
    expect(trace.points[trace.points.length - 1]?.bytes).toBe(4_000_000); expect(trace.serverTcpMinRttMs).toBe(12);
    expect(trace.accounting).toBe('server-received'); expect(estimateTrace(trace).sustainedMbps).toBeCloseTo(4);
    expect(TestSocket.instances.every(socket => socket.send.mock.calls.length === 0)).toBe(true); budget.dispose();
  });
  it.each([4, -1, 1.5, '100', null])('invalidates reset or malformed receiver counter %s', async value => {
    const budget = setup();
    const pending = websocketTransfer('ndt7', 'wss://reference.example/ndt', 'upload', 10_000, budget, () => {});
    const socket = TestSocket.instances[0]; socket.message({ AppInfo: { NumBytes: 100 } });
    await vi.advanceTimersByTimeAsync(6000); socket.message({ AppInfo: { NumBytes: value } });
    const { trace } = await pending; expect(estimateTrace(trace).qualification).toBe('unavailable'); expect(trace.integrityError).toBeDefined(); budget.dispose();
  });
  it('excludes the ambiguous final interval after a background transition', async () => {
    const budget = setup();
    const pending = websocketTransfer('ndt7', 'wss://reference.example/ndt', 'download', 10_000, budget, () => {});
    await vi.advanceTimersByTimeAsync(6300); budget.stop('background'); const { trace } = await pending;
    expect(trace.points[trace.points.length - 1]?.valid).toBe(false); expect(estimateTrace(trace).measuredMs).toBe(4000); budget.dispose();
  });
});
