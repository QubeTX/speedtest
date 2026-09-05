// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.

import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startReference } from './controlled-reference.mjs';

const reference = await startReference();
const browser = await chromium.launch({ channel: 'chrome' });
const rows = [], errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, reducedMotion: 'no-preference' });
  // Freeze this loaded candidate while unrelated files are edited in the workspace.
  await page.routeWebSocket('**', socket => socket.close());
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.SPEEDQX_WEB_URL ?? 'http://127.0.0.1:5175');
  await page.evaluate(async () => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: Cassette } = await import('/src/components/mechanism/TapeMechanism.tsx');
    const { httpTransfer, RunBudget } = await import('/src/services/acquisition-v5.ts');
    const { estimateTrace } = await import('/src/services/measurement-v5.ts');
    const host = document.createElement('div');
    Object.assign(host.style, { position: 'fixed', inset: '0', background: '#eee', zIndex: '9999', padding: '16px' });
    document.body.append(host);
    const root = ReactDOM.createRoot(host);
    window.runAnimationComparison = async ({ endpoint, direction, motion }) => {
      const render = (rate, progress) => root.render(React.createElement('div', {},
        React.createElement(Cassette, { phase: motion ? direction : 'idle', currentSpeed: rate, downloadProgress: direction === 'download' ? progress : 100, uploadProgress: direction === 'upload' ? progress : 0, onPress() {} }),
        React.createElement('p', {}, `${direction} ${rate.toFixed(2)} Mbps`)));
      render(0, 0);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const budget = new RunBudget(500_000_000, 90000);
      const startedAt = performance.timeOrigin + performance.now();
      try {
        const { trace } = await httpTransfer('cloudflare', endpoint, direction, 10000, budget, render);
        const rotations = [...host.querySelectorAll('g')].map(g => g.style.transform).filter(Boolean);
        return { trace, estimate: estimateTrace(trace), startedAt, rotations };
      } finally { budget.dispose(); render(0, 100); }
    };
  });
  const cdp = await page.context().newCDPSession(page);
  for (const cpuRate of (process.env.CPU_RATES ?? '1,4').split(',').map(Number)) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    for (const direction of ['download', 'upload']) for (let pair = 0; pair < Number(process.env.PAIRS ?? 4); pair++) {
      for (const motion of pair % 2 ? [true, false] : [false, true]) {
        const run = `animation-${cpuRate}-${direction}-${pair}-${motion}-${Date.now()}`;
        const output = await page.evaluate(args => window.runAnimationComparison(args), { endpoint: `${reference.url}/test?scenario=steady&run=${run}`, direction, motion });
        const start = output.trace.points.find(p => p.t >= 2000).t, end = output.trace.points.at(-1).t;
        const deliveredBytes = reference.snapshot(`${run}-${direction}`).filter(p => p.t >= output.startedAt + start && p.t <= output.startedAt + end).reduce((n, p) => n + p.bytes, 0);
        const deliveredMbps = deliveredBytes * .008 / (end - start);
        if (motion) assert(output.rotations.some(r => r !== 'rotate(0.000deg)'), 'The active cassette must actually rotate during measurement');
        rows.push({ cpuRate, direction, pair, motion, deliveredMbps, ...output });
        console.log(`CPU ${cpuRate}x ${direction} pair ${pair + 1} motion ${motion}: ${deliveredMbps.toFixed(3)} Mbps independently delivered`);
      }
    }
  }
} finally {
  await browser.close(); await reference.close();
  const median = values => { const v = [...values].sort((a, b) => a - b); return v.length ? (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2 : null; };
  const comparisons = [];
  for (const cpuRate of [...new Set(rows.map(r => r.cpuRate))]) for (const direction of ['download', 'upload']) {
    const pairs = [...new Set(rows.filter(r => r.cpuRate === cpuRate && r.direction === direction).map(r => r.pair))].map(pair => {
      const match = rows.filter(r => r.cpuRate === cpuRate && r.direction === direction && r.pair === pair), on = match.find(r => r.motion), off = match.find(r => !r.motion);
      return on && off ? { pair, regressionPct: (1 - on.deliveredMbps / off.deliveredMbps) * 100 } : null;
    }).filter(Boolean);
    comparisons.push({ cpuRate, direction, pairs, medianRegressionPct: median(pairs.map(p => p.regressionPct)) });
  }
  await mkdir('evidence/v5', { recursive: true });
  await writeFile('evidence/v5/animation-impact-browser.json', JSON.stringify({ capturedAt: new Date().toISOString(), browserVersion: browser.version(), kind: 'paired cassette component with real acquisition and independent loopback delivery', limitations: 'Alternating pair order; same mounted production component and live metric updates, with transfer motion enabled or idle static geometry. Chromium CPU throttling models a constrained browser, not a physical iPhone/Android. Application pacer, no physical line-capacity or native animation claim.', comparisons, errors, rows }, null, 2) + '\n');
  console.log(JSON.stringify({ comparisons, errors }, null, 2));
  assert.deepEqual(errors, []);
}
