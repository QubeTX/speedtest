// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.
// Loopback test fixture only. Never deployed with the product.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

export const scenarios = {
  steady: { rate: () => 20, latency: 0 },
  asymmetric: { rate: (_t, direction) => direction === 'upload' ? 5 : 40, latency: 0 },
  latency: { rate: () => 20, latency: 150 },
  bursty: { rate: t => Math.floor(t / 1000) % 2 ? 36 : 4, latency: 0 },
  stalls: { rate: t => Math.floor(t / 1000) % 4 === 2 ? 0 : 20, latency: 0 },
};

class Pacer {
  queue = []; credit = 0; bytes = 0; history = []; started = performance.now(); last = this.started;
  constructor(scenario, direction) {
    this.scenario = scenario; this.direction = direction;
    this.timer = setInterval(() => this.tick(), 5);
  }
  tick() {
    const now = performance.now(), dt = now - this.last; this.last = now;
    this.credit = Math.min(131072, this.credit + this.scenario.rate(now - this.started, this.direction) * 125 * dt);
    while (this.queue.length) {
      const head = this.queue[0];
      if (head.signal.aborted) { this.queue.shift(); head.reject(new Error('closed')); continue; }
      if (this.credit < head.bytes) break;
      this.credit -= head.bytes; this.bytes += head.bytes;
      this.history.push({ t: performance.timeOrigin + now, bytes: head.bytes });
      this.queue.shift(); head.resolve();
    }
  }
  take(bytes, signal) { return new Promise((resolve, reject) => { this.queue.push({ bytes, signal, resolve, reject }); }); }
  close() { clearInterval(this.timer); for (const job of this.queue) job.reject(new Error('fixture closed')); this.queue = []; }
}

export async function startReference({ maxRequestBytes = 8_000_000 } = {}) {
  const pacers = new Map(), payload = randomBytes(65536);
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Timing-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const scenario = scenarios[url.searchParams.get('scenario')] ?? scenarios.steady;
    const direction = req.method === 'POST' ? 'upload' : 'download';
    const key = `${url.searchParams.get('run') ?? 'default'}-${direction}`;
    if (!pacers.has(key)) pacers.set(key, new Pacer(scenario, direction));
    const pacer = pacers.get(key), owner = new AbortController();
    res.on('close', () => owner.abort());
    try {
      if (scenario.latency) await new Promise(resolve => setTimeout(resolve, scenario.latency));
      if (direction === 'upload') {
        for await (const chunk of req) for (let offset = 0; offset < chunk.length; offset += 65536) {
          await pacer.take(Math.min(65536, chunk.length - offset), owner.signal);
        }
        res.setHeader('Content-Length', '0'); res.end();
      } else {
        const total = Math.min(maxRequestBytes, Math.max(0, Number(url.searchParams.get('bytes') ?? 0)));
        res.setHeader('Content-Length', total); res.setHeader('Content-Type', 'application/octet-stream'); res.flushHeaders();
        for (let sent = 0; sent < total && !owner.signal.aborted;) {
          const n = Math.min(payload.length, total - sent);
          await pacer.take(n, owner.signal);
          if (owner.signal.aborted) break;
          if (!res.write(payload.subarray(0, n))) await new Promise(resolve => {
            const finish = () => { res.removeListener('drain', finish); res.removeListener('close', finish); resolve(); };
            res.once('drain', finish); res.once('close', finish);
          });
          sent += n;
        }
        res.end();
      }
    } catch { res.destroy(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, snapshot: key => pacers.get(key)?.history ?? [], close: async () => {
    for (const p of pacers.values()) p.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  } };
}
