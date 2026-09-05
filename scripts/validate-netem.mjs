// Receiver-ingress Linux netem comparisons. The shell owns isolated namespaces.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
const execute = promisify(execFile);
const namespaces = [process.env.SQX_CLIENT_NS, process.env.SQX_SERVER_NS];
assert(namespaces.every(n => /^sqx-(client|server)-\d+$/.test(n ?? '')));
const cases = [
  { name: 'clean', down: 20, up: 20, delay: 0, loss: 0 },
  { name: 'asymmetric', down: 40, up: 5, delay: 0, loss: 0 },
  { name: 'latency', down: 20, up: 20, delay: 75, loss: 0 },
  { name: 'loss', down: 20, up: 5, delay: 40, loss: 0.5 },
];
function shape(c) {
  namespaces.forEach((ns, i) => execFileSync('sudo', ['ip', 'netns', 'exec', ns, 'tc', 'qdisc', 'replace', 'dev', 'ifb0', 'root', 'netem', 'limit', '1000', 'delay', `${c.delay}ms`, 'loss', `${c.loss}%`, 'rate', `${i ? c.up : c.down}mbit`], { stdio: 'pipe' }));
}
function qdiscs() {
  return namespaces.map(ns => JSON.parse(execFileSync('sudo', ['ip', 'netns', 'exec', ns, 'tc', '-j', '-s', 'qdisc', 'show', 'dev', 'ifb0'], { encoding: 'utf8' })));
}
for (let i = 0; ; i++) {
  try { await fetch('http://127.0.0.1:5175'); await fetch('http://192.0.2.2:8800'); break; }
  catch (e) { if (i > 60) throw e; await new Promise(r => setTimeout(r, 500)); }
}
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.routeWebSocket('**', socket => socket.close());
await page.goto('http://127.0.0.1:5175');
// Compile all measurement modules on the unshaped local Vite route before runs.
await page.evaluate(async () => { await import('/src/services/acquisition-v5.ts'); await import('/src/services/measurement-v5.ts'); await import('/src/services/aggregated-provider.ts'); });
const outcomes = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  for (const scenario of cases) for (let repetition = 0; repetition < 2; repetition++) {
    shape(scenario);
    for (const direction of ['download', 'upload']) for (const surface of (repetition % 2 ? ['rust', 'browser'] : ['browser', 'rust'])) {
      const run = `${scenario.name}-${repetition}-${direction}-${surface}`;
      const endpoint = `http://192.0.2.2:8800/test?run=${run}`;
      let output;
      if (surface === 'browser') output = await page.evaluate(async ({ endpoint, direction }) => {
        const { RunBudget, httpTransfer } = await import('/src/services/acquisition-v5.ts');
        const { estimateTrace } = await import('/src/services/measurement-v5.ts');
        const budget = new RunBudget(500_000_000, 90_000), startedAt = performance.timeOrigin + performance.now();
        try { const { trace } = await httpTransfer('cloudflare', endpoint, direction, 10000, budget, () => {}); return { trace, estimate: estimateTrace(trace), startedAt, budgetBytes: budget.used }; }
        finally { budget.dispose(); }
      }, { endpoint, direction });
      else output = JSON.parse((await execute(process.env.SPEEDQX_ACQUIRE, [endpoint, direction, '10000'], { timeout: 25000 })).stdout);
      assert(output.trace.points.every((p, i, a) => Number.isFinite(p.t) && p.bytes >= 0 && (!i || (p.t > a[i - 1].t && p.bytes >= a[i - 1].bytes))));
      assert(output.estimate.sustainedMbps == null || Number.isFinite(output.estimate.sustainedMbps));
      // Server receipts/writes are diagnostic evidence. Under netem, download
      // writes precede delivery and upload receipt precedes acknowledgement:
      // neither is an independent timestamp-exact payload truth for this window.
      const records = await (await fetch(`http://192.0.2.2:8800/__snapshot?key=${run}-${direction}`)).json();
      const v4EstimatorMbps = await page.evaluate(async trace => {
        const { plateauStart, filterOutliersIQR, modifiedTrimean } = await import('/src/services/statistics.ts');
        let samples = trace.points.slice(1).map((p, i) => (p.bytes - trace.points[i].bytes) * .008 / (p.t - trace.points[i].t));
        samples = samples.slice(plateauStart(samples));
        if (trace.direction === 'upload') samples = samples.sort((a, b) => b - a).slice(0, Math.ceil(samples.length / 2));
        return modifiedTrimean(filterOutliersIQR(samples));
      }, output.trace);
      outcomes.push({ kind: 'v5-acquisition', scenario, repetition, direction, surface, v4EstimatorMbps, serverTrace: records, qdiscs: qdiscs(), ...output });
      console.log(`${scenario.name} #${repetition} ${surface} ${direction}: v5 ${output.estimate.sustainedMbps}, v4 replay ${v4EstimatorMbps}`);
    }
    const baseline = await browser.newPage();
    await baseline.routeWebSocket('**', socket => socket.close());
    await baseline.addInitScript(({ run }) => {
      const originalFetch = fetch.bind(window), entries = performance.getEntriesByName.bind(performance), mapped = new Map();
      window.fetch = (input, options) => {
        const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(raw, location.href);
        if (url.hostname === 'speed.cloudflare.com') {
          const to = new URL('http://192.0.2.2:8800/test' + url.search); to.searchParams.set('run', run); mapped.set(raw, to.href); return originalFetch(to, options);
        }
        if (url.origin !== location.origin) return Promise.reject(new Error('Public measurements disabled in fixture'));
        return originalFetch(input, options);
      };
      performance.getEntriesByName = (name, type) => entries(mapped.get(name) ?? name, type);
    }, { run: `v4-${scenario.name}-${repetition}` });
    await baseline.goto('http://127.0.0.1:5175');
    const output = await baseline.evaluate(async () => {
      const { AggregatedProvider } = await import('/src/services/aggregated-provider.ts');
      const provider = new AggregatedProvider({ profile: 'fast', consent: false }); let timer;
      try { return await Promise.race([provider.start(() => {}), new Promise((_, reject) => { timer = setTimeout(() => { provider.stop(); reject(new Error('90 second fixture cap')); }, 90000); })]); }
      finally { clearTimeout(timer); provider.stop(); }
    });
    outcomes.push({ kind: 'v4-original-transport', scenario, repetition, result: output, qdiscs: qdiscs() });
    console.log(`${scenario.name} #${repetition} original v4: ${output.downloadSpeed} down / ${output.uploadSpeed} up`);
    await baseline.close();
  }
  assert.equal(errors.length, 0, errors.join('\n'));
} finally {
  await browser.close(); await mkdir('evidence/v5', { recursive: true });
  await writeFile('evidence/v5/netem.json', JSON.stringify({ capturedAt: new Date().toISOString(), websiteRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), browser: browser.version(), kind: 'Isolated Linux receiver-ingress netem', topology: 'Two namespaces joined by a veth pair, no default routes. Netem on IFB at each receiver ingress; segmentation/offload disabled.', limitations: 'Configured rates include TCP/IP overhead and are not expected application throughput. Random loss and shared hosted CPUs affect paired repeatability. Server writes/receipts are diagnostic traces, not timestamp-exact delivered payload truth under queuing and acknowledgement delay. These comparisons extend loss/latency coverage without establishing absolute accuracy or physical-device acceptance. Original v4 uses its own schedule; zero with failed/missing provider output means unavailable.', outcomes, errors }, null, 2) + '\n');
}
