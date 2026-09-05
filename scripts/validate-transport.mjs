// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.
import { chromium, firefox, webkit } from '@playwright/test';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { startReference, scenarios } from './controlled-reference.mjs';

const execute = promisify(execFile);
const browserName = process.env.BROWSER ?? 'chromium';
const reference = await startReference();
const browser = await ({ chromium, firefox, webkit }[browserName]).launch(browserName === 'chromium' ? { channel: 'chrome' } : {});
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
await page.routeWebSocket('**', socket => socket.close());
const outcomes = [];
try {
  await page.goto(process.env.SPEEDQX_WEB_URL ?? 'http://127.0.0.1:5175');
  const selected = process.env.SCENARIOS?.split(',') ?? Object.keys(scenarios);
  for (let repetition = 0; repetition < Number(process.env.REPEATS ?? 1); repetition++) for (const scenario of selected) for (const direction of ['download', 'upload']) for (const surface of ['browser', 'rust']) {
    const run = `${scenario}-${direction}-${surface}-${Date.now()}`;
    const endpoint = `${reference.url}/test?scenario=${scenario}&run=${run}`;
    let output;
    if (surface === 'browser') {
      output = await page.evaluate(async ({ endpoint, direction }) => {
        const { RunBudget, httpTransfer } = await import('/src/services/acquisition-v5.ts');
        const { estimateTrace } = await import('/src/services/measurement-v5.ts');
        const budget = new RunBudget(500_000_000, 90_000);
        const startedAt = performance.timeOrigin + performance.now();
        try { const { trace } = await httpTransfer('cloudflare', endpoint, direction, 10_000, budget, () => {}); return { trace, estimate: estimateTrace(trace), budgetBytes: budget.used, startedAt }; }
        finally { budget.dispose(); }
      }, { endpoint, direction });
    } else {
      const command = process.env.SPEEDQX_ACQUIRE ?? path.resolve('../qube-network-diagnostics/target/debug/examples/v5-acquire.exe');
      const { stdout } = await execute(command, [endpoint, direction, '10000'], { timeout: 20000 }); output = JSON.parse(stdout);
    }
    const comparison = await page.evaluate(async ({ trace }) => {
      const { plateauStart, filterOutliersIQR, modifiedTrimean } = await import('/src/services/statistics.ts');
      const raw = trace.points.slice(1).map((p, i) => (p.bytes - trace.points[i].bytes) * .008 / (p.t - trace.points[i].t));
      const after = raw.slice(plateauStart(raw));
      return modifiedTrimean(filterOutliersIQR(trace.direction === 'upload' ? [...after].sort((a, b) => b - a).slice(0, Math.ceil(after.length / 2)) : after));
    }, output);
    const p = output.trace.points, start = p.find(x => x.t >= 2000).t, end = p.at(-1).t;
    let integral = 0;
    for (let t = start; t < end; t += 1) integral += scenarios[scenario].rate(t, direction) * Math.min(1, end - t);
    const rateLimit = integral / (end - start);
    const referenceTrace = reference.snapshot(`${run}-${direction}`);
    const delivered = referenceTrace.filter(p => p.t >= output.startedAt + start && p.t <= output.startedAt + end).reduce((n, p) => n + p.bytes, 0);
    const target = delivered * .008 / (end - start);
    const row = { repetition, scenario, direction, surface, browser: surface === 'browser' ? browserName : null, configuredRateLimitMbps: rateLimit, targetMbps: target, referenceTrace, v4EstimatorMbps: comparison, v5Mbps: output.estimate.sustainedMbps,
      v4ErrorPct: Math.abs(comparison / target - 1) * 100, v5ErrorPct: Math.abs(output.estimate.sustainedMbps / target - 1) * 100, ...output };
    outcomes.push(row);
    console.log(`${scenario} ${direction} ${surface}: reference ${target.toFixed(2)}, v4 estimator ${comparison.toFixed(2)}, v5 ${output.estimate.sustainedMbps?.toFixed(2)} Mbps (${row.v5ErrorPct.toFixed(2)}% error)`);
  }
} finally {
  await browser.close(); await reference.close();
  await mkdir('evidence/v5', { recursive: true });
  await writeFile(`evidence/v5/transport-${browserName}${process.env.REPORT_SUFFIX ?? ''}.json`, JSON.stringify({ capturedAt: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceDirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), node: process.version, browserVersion: browser.version(), kind: 'loopback-paced-http-acquisition', reference: 'Independent server-side delivered payload, aligned by epoch clocks on this host to the actual client measurement window. Configured rate limits are reported separately from delivered throughput.', limitations: 'A shared application-level pacer, not an OS packet shaper or physical radio. v4 comparison replays its point estimator over the acquired counters; it does not run v4 transports. Native app and production paths require separate acceptance.', outcomes }, null, 2) + '\n');
}
