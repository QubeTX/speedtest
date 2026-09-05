// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.

import { WARMUP_MS, type CounterPoint, type Direction, type MeasurementTrace, type StopReason } from './measurement-v5';

/** One owner for every timer, fetch and socket in a run. Data budgets count synthetic payload. */
export class RunBudget {
  readonly controller = new AbortController();
  readonly started = performance.now();
  readonly sockets = new Set<WebSocket>();
  used = 0;
  private reserved = 0;
  reason: StopReason = 'complete';
  private timer: ReturnType<typeof setTimeout>;
  constructor(readonly limit: number, readonly capMs: number) {
    if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isFinite(capMs) || capMs <= 0) throw new Error('Invalid run budget');
    this.timer = setTimeout(() => this.stop('time-limit'), capMs);
  }
  get signal() { return this.controller.signal; }
  reserve(wanted: number): number {
    if (this.signal.aborted) return 0;
    const granted = Math.max(0, Math.min(wanted, this.limit - this.used - this.reserved));
    this.reserved += granted;
    if (!granted && this.reserved === 0) this.stop('byte-limit');
    return granted;
  }
  release(bytes: number) { this.reserved = Math.max(0, this.reserved - bytes); }
  consume(bytes: number, reservation = 0) {
    this.release(reservation); this.used += bytes;
    if (this.used >= this.limit) this.stop('byte-limit');
  }
  stop(reason: StopReason) {
    if (this.signal.aborted) return;
    this.reason = reason; this.controller.abort();
    for (const socket of this.sockets) { try { socket.close(); } catch { /* Connecting socket already closed. */ } }
  }
  dispose() { clearTimeout(this.timer); for (const socket of this.sockets) { try { socket.close(); } catch { /* Already closed. */ } } this.sockets.clear(); }
}

export function endpointLabel(url: string): string {
  const parsed = new URL(url); return parsed.origin + parsed.pathname;
}
export interface TransferOutput { trace: MeasurementTrace; kernelMinRttMs?: number }
export type LiveTransfer = (mbps: number, progress: number, confirmedBytes: number) => void;
function syntheticPayload(size: number) {
  const bytes = new Uint8Array(size);
  for (let offset = 0; offset < size; offset += 65_536) crypto.getRandomValues(bytes.subarray(offset, Math.min(size, offset + 65_536)));
  return bytes;
}
function traceFor(provider: string, endpoint: string, direction: Direction, streams: number, transport: 'https' | 'websocket'): MeasurementTrace {
  return { provider, endpoint: endpointLabel(endpoint), transport, streams, direction,
    accounting: direction === 'download' ? 'received' : transport === 'https' ? 'completed-request' : 'server-received',
    warmupMs: WARMUP_MS, points: [{ t: 0, bytes: 0 }], stopReason: 'complete' };
}
function addPoint(points: CounterPoint[], start: number, bytes: number, live: LiveTransfer, durationMs: number) {
  const t = performance.now() - start, last = points[points.length - 1];
  if (t <= last.t) return;
  points.push({ t, bytes }); live((bytes - last.bytes) * 0.008 / (t - last.t), Math.min(100, t / durationMs * 100), bytes);
}
function linkedController(budget: RunBudget, durationMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  budget.signal.addEventListener('abort', abort, { once: true });
  if (budget.signal.aborted) abort();
  const timer = setTimeout(abort, durationMs);
  return { controller, dispose() { clearTimeout(timer); budget.signal.removeEventListener('abort', abort); } };
}

/** Two bounded HTTP streams. Bodies are consumed as bytes, never decoded into text. */
export async function httpTransfer(provider: string, endpoint: string, direction: Direction, durationMs: number, budget: RunBudget, live: LiveTransfer, streams = 2): Promise<TransferOutput> {
  const trace = traceFor(provider, endpoint, direction, streams, 'https');
  const start = performance.now(), owned = linkedController(budget, durationMs);
  let received = 0, successful = 0, failure: string | null = null;
  const payload = direction === 'upload' ? syntheticPayload(8_000_000) : undefined;
  const tick = () => addPoint(trace.points, start, received, live, durationMs);
  const timer = setInterval(tick, 500);
  const lane = async () => {
    // Receiver confirmations must resolve much faster than the measurement window.
    // Large initial uploads on slow links can otherwise straddle the entire warm-up.
    let size = direction === 'upload' ? 1024 : 1_000_000;
    while (!owned.controller.signal.aborted) {
      const libreDownload = provider === 'librespeed' && direction === 'download';
      const allocation = budget.reserve(libreDownload ? Math.max(1_048_576, Math.floor(size / 1_048_576) * 1_048_576) : size);
      if (!allocation) break;
      if (libreDownload && allocation % 1_048_576 !== 0) { budget.release(allocation); break; }
      let consumed = 0;
      const requestStart = performance.now();
      try {
        const url = new URL(endpoint);
        url.searchParams.set('sqx', `${Math.random().toString(36).slice(2)}`);
        const ranged = provider === 'cachefly' || provider === 'vultr';
        if (direction === 'download') {
          if (libreDownload) { url.searchParams.set('ckSize', String(allocation / 1_048_576)); url.searchParams.set('cors', 'true'); }
          else if (provider === 'fastcom') url.pathname = url.pathname.replace(/\/range\/\d+-\d+/, `/range/0-${allocation - 1}`);
          else if (!ranged) url.searchParams.set('bytes', String(allocation));
        }
        const body = payload?.subarray(0, allocation);
        if (body) { budget.consume(allocation, allocation); consumed = allocation; }
        const response = await fetch(url, { method: body ? 'POST' : 'GET', body, headers: ranged ? { Range: `bytes=0-${allocation - 1}` } : undefined, signal: owned.controller.signal, cache: 'no-store', credentials: 'omit' });
        if (!response.ok) { failure = `HTTP ${response.status}`; owned.controller.abort(); break; }
        if (ranged && response.status !== 206) { await response.body?.cancel(); failure = 'Server did not honor byte range'; owned.controller.abort(); break; }
        if (direction === 'download') {
          if (response.body?.getReader) {
            const reader = response.body.getReader();
            try {
              while (!owned.controller.signal.aborted) {
                const chunk = await reader.read(); if (chunk.done) break;
                received += chunk.value.byteLength; consumed += chunk.value.byteLength;
                budget.consume(chunk.value.byteLength, chunk.value.byteLength);
                if (consumed > allocation) { failure = 'Unexpected response size'; owned.controller.abort(); break; }
              }
            } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
          } else {
            const length = Number(response.headers.get('Content-Length'));
            if (!Number.isSafeInteger(length) || length < 0 || length > allocation || !response.headers.has('Content-Length')) {
              failure = 'Unbounded response on a non-streaming runtime'; owned.controller.abort(); break;
            }
            const data = await response.arrayBuffer();
            received += data.byteLength; consumed += data.byteLength; budget.consume(data.byteLength, data.byteLength);
            if (data.byteLength > allocation) { failure = 'Unexpected response size'; owned.controller.abort(); }
          }
        } else { received += allocation; await response.body?.cancel().catch(() => {}); }
        successful++;
        size = Math.round(Math.max(direction === 'upload' ? 1024 : 64_000, Math.min(8_000_000, allocation * 2, allocation * (direction === 'upload' ? 250 : 2000) / Math.max(1, performance.now() - requestStart))));
      } catch { if (!owned.controller.signal.aborted) failure = 'Transfer failed'; break; }
      finally { if (direction === 'download') budget.release(Math.max(0, allocation - consumed)); }
    }
  };
  try { await Promise.all(Array.from({ length: streams }, lane)); }
  finally { clearInterval(timer); tick(); owned.controller.abort(); owned.dispose(); }
  trace.stopReason = budget.signal.aborted ? budget.reason : failure || (!received && !successful) ? 'failed' : 'complete';
  if (trace.stopReason === 'background' || trace.stopReason === 'network-change') trace.points[trace.points.length - 1].valid = false;
  return { trace };
}

interface Located { machine: string; download: string; upload: string }
export async function locateMlab(provider: 'msak' | 'ndt7', durationMs: number, budget: RunBudget): Promise<Located> {
  const owned = linkedController(budget, 8000);
  let body;
  try {
  const response = await fetch(`https://locate.measurementlab.net/v2/nearest/${provider === 'msak' ? 'msak/throughput1' : 'ndt/ndt7'}`, { signal: owned.controller.signal, credentials: 'omit' });
  if (!response.ok) throw new Error(`M-Lab discovery HTTP ${response.status}`);
  body = await response.json();
  } finally { owned.dispose(); }
  const entry = body.results?.[0];
  if (!entry?.urls) throw new Error('No M-Lab server available');
  const path = provider === 'msak' ? '/throughput/v1/' : '/ndt/v7/';
  const build = (direction: Direction) => {
    const url = new URL(entry.urls[`wss://${path}${direction}`]);
    if (url.protocol !== 'wss:') throw new Error('Secure M-Lab transport required');
    if (provider === 'msak') { url.searchParams.set('streams', '2'); url.searchParams.set('duration', String(Math.min(durationMs, 25000))); }
    url.searchParams.set('client_name', 'speedqx'); url.searchParams.set('client_version', '5.0');
    return url.toString();
  };
  return { machine: entry.machine || 'M-Lab', download: build('download'), upload: build('upload') };
}

/** Receiver-accounted WebSocket collector for MSAK and NDT7, with no insecure fallback. */
export async function websocketTransfer(provider: 'msak' | 'ndt7', endpoint: string, direction: Direction, durationMs: number, budget: RunBudget, live: LiveTransfer): Promise<TransferOutput> {
  const streams = provider === 'msak' ? 2 : 1, trace = traceFor(provider, endpoint, direction, streams, 'websocket');
  const start = performance.now(), owned = linkedController(budget, durationMs);
  const counters = Array(streams).fill(0) as number[];
  let minRtt: number | undefined, failed = false;
  const payload = direction === 'upload' ? syntheticPayload(1_048_576) : undefined;
  const tick = () => addPoint(trace.points, start, counters.reduce((a, b) => a + b, 0), live, durationMs);
  const sampler = setInterval(tick, 500);
  const lane = (index: number) => new Promise<void>(resolve => {
    if (owned.controller.signal.aborted) { resolve(); return; }
    const socket = new WebSocket(endpoint, provider === 'msak' ? 'net.measurementlab.throughput.v1' : 'net.measurementlab.ndt.v7');
    socket.binaryType = 'arraybuffer'; budget.sockets.add(socket);
    let closed = false, uploadTimer: ReturnType<typeof setTimeout> | undefined, frame = payload?.subarray(0, 8192) ?? new Uint8Array(0), sent = 0;
    const finish = () => {
      if (closed) return; closed = true; clearTimeout(uploadTimer);
      owned.controller.signal.removeEventListener('abort', finish);
      socket.onmessage = null; socket.onopen = null; socket.onerror = null; socket.onclose = null;
      socket.close(); budget.sockets.delete(socket); resolve();
    };
    owned.controller.signal.addEventListener('abort', finish, { once: true });
    socket.onerror = () => { failed = true; finish(); }; socket.onclose = finish;
    socket.onmessage = event => {
      if (closed) return;
      if (typeof event.data === 'string') {
        try {
          const m = JSON.parse(event.data), rtt = m.TCPInfo?.MinRTT;
          if (typeof rtt === 'number' && Number.isFinite(rtt) && rtt > 0) minRtt = Math.min(minRtt ?? Infinity, rtt / 1000);
          const bytes = provider === 'msak' ? m.Application?.BytesReceived : m.AppInfo?.NumBytes;
          if (direction === 'upload' && bytes !== undefined) {
            if (!Number.isSafeInteger(bytes) || bytes < counters[index]) { trace.integrityError = 'Invalid or reset measurement counters'; failed = true; finish(); } else counters[index] = bytes;
          }
        } catch { /* Ignore non-measurement frames. */ }
      } else if (direction === 'download' && event.data instanceof ArrayBuffer) {
        if (event.data.byteLength > 1 << 24) { trace.integrityError = 'Provider exceeded protocol message limit'; failed = true; finish(); return; }
        counters[index] += event.data.byteLength; budget.consume(event.data.byteLength);
      }
    };
    const send = () => {
      if (closed || owned.controller.signal.aborted || socket.readyState !== WebSocket.OPEN) return;
      // Bounded 1 MiB frames / 2 MiB per-socket queue; yield every burst.
      for (let i = 0; i < 8 && socket.bufferedAmount < 2_000_000; i++) {
        const n = budget.reserve(frame.length); if (!n) { finish(); return; }
        try { socket.send(n === frame.length ? frame : frame.subarray(0, n)); budget.consume(n, n); sent += n; }
        catch { budget.release(n); failed = true; finish(); return; }
        if (frame.length < 1_048_576 && sent >= 16 * frame.length) frame = payload!.subarray(0, frame.length * 2);
        if (closed || owned.controller.signal.aborted) return;
      }
      uploadTimer = setTimeout(send, 4);
    };
    socket.onopen = () => { if (direction === 'upload') send(); };
  });
  try { await Promise.all(Array.from({ length: streams }, (_, i) => lane(i))); }
  finally { clearInterval(sampler); tick(); owned.controller.abort(); owned.dispose(); }
  trace.stopReason = budget.signal.aborted ? budget.reason : failed || counters.every(n => n === 0) ? 'failed' : 'complete';
  if (trace.stopReason === 'background' || trace.stopReason === 'network-change') trace.points[trace.points.length - 1].valid = false;
  if (minRtt !== undefined) trace.serverTcpMinRttMs = minRtt;
  return { trace, kernelMinRttMs: minRtt };
}

/** Existing public endpoints only. Probe pairs are bounded; no transfer starts until selection ends. */
export async function locateSupplementary(provider: 'librespeed' | 'vultr' | 'cachefly' | 'fastcom', budget: RunBudget): Promise<{ machine: string; download: string; upload?: string }> {
  if (provider === 'cachefly') return { machine: 'CacheFly', download: 'https://cachefly.cachefly.net/100mb.test' };
  if (provider === 'fastcom') {
    const owned = linkedController(budget, 8000);
    try {
      const response = await fetch('https://speedqx.com/api/fastcom-targets', { signal: owned.controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error(`Existing fast.com discovery relay HTTP ${response.status}`);
      const body = await response.json();
      const target = new URL(body.targets?.[0]);
      if (target.protocol !== 'https:' || !target.hostname.endsWith('.nflxvideo.net') || !/\/range\/\d+-\d+/.test(target.pathname)) throw new Error('No validated Netflix target');
      return { machine: target.hostname, download: target.toString() };
    } finally { owned.dispose(); }
  }
  const candidates = provider === 'librespeed'
    ? ['nyc', 'fra', 'lon', 'atl', 'la'].map(pop => `https://${pop}.speedtest.clouvider.net/backend/empty.php?cors=true`)
    : ['nj-us', 'lax-ca-us', 'fra-de', 'sgp', 'syd-au', 'tyo-jp', 'ams-nl', 'lon-gb'].map(pop => `https://${pop}-ping.vultr.com/vultr.com.100MB.bin`);
  let best: { url: string; rtt: number } | undefined;
  for (let i = 0; i < candidates.length && !budget.signal.aborted; i += 2) {
    const outcomes = await Promise.all(candidates.slice(i, i + 2).map(async url => {
      const owned = linkedController(budget, 1500), start = performance.now();
      try {
        const response = await fetch(url, { method: 'HEAD', signal: owned.controller.signal, credentials: 'omit', cache: 'no-store' });
        return response.ok ? { url, rtt: performance.now() - start } : undefined;
      } catch { return undefined; } finally { owned.dispose(); }
    }));
    for (const outcome of outcomes) if (outcome && (!best || outcome.rtt < best.rtt)) best = outcome;
  }
  if (!best) throw new Error('No readable public endpoint');
  return { machine: new URL(best.url).hostname, download: provider === 'librespeed' ? best.url.replace('empty.php', 'garbage.php') : best.url,
    ...(provider === 'librespeed' ? { upload: best.url } : {}) };
}
