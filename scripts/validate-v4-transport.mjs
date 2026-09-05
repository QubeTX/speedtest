// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.

import { chromium, firefox, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startReference, scenarios } from './controlled-reference.mjs';

const reference = await startReference({ maxRequestBytes: 250_000_000 });
const browserName = process.env.BROWSER ?? 'chromium';
const browser = await ({ chromium, firefox, webkit }[browserName]).launch(browserName === 'chromium' ? { channel: 'chrome' } : {});
const outcomes = [];
try {
  for (const scenario of (process.env.SCENARIOS ?? Object.keys(scenarios).join(',')).split(',')) {
    const page = await browser.newPage(), run = `v4-${scenario}-${Date.now()}`;
    await page.routeWebSocket('**', socket => socket.close());
    await page.addInitScript(({ reference, scenario, run }) => {
      const originalFetch = window.fetch.bind(window), originalEntries = performance.getEntriesByName.bind(performance);
      const mapped = new Map();
      window.fetch = (input, options) => {
        const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(raw, location.href);
        if (url.hostname === 'speed.cloudflare.com') {
          const replacement = new URL(reference + '/test' + url.search);
          replacement.searchParams.set('scenario', scenario); replacement.searchParams.set('run', run);
          mapped.set(raw, replacement.href);
          return originalFetch(replacement, options);
        }
        // No public measurements, TURN credentials or discovery from this fixture.
        if (url.origin !== location.origin) return Promise.reject(new Error('Non-reference service disabled in controlled comparison'));
        return originalFetch(input, options);
      };
      performance.getEntriesByName = (name, type) => originalEntries(mapped.get(name) ?? name, type);
    }, { reference: reference.url, scenario, run });
    await page.goto(process.env.SPEEDQX_WEB_URL ?? 'http://127.0.0.1:5175');
    const output = await page.evaluate(async () => {
      const { AggregatedProvider } = await import('/src/services/aggregated-provider.ts');
      const provider = new AggregatedProvider({ profile: 'fast', consent: false });
      const progress = [], startedAt = performance.timeOrigin + performance.now();
      let timer;
      try {
        const result = await Promise.race([
          provider.start(p => progress.push({ t: performance.timeOrigin + performance.now(), ...p })),
          new Promise((_, reject) => { timer = setTimeout(() => { provider.stop(); reject(new Error('Controlled fixture 90-second cap')); }, 90000); }),
        ]);
        return { result, progress, startedAt, endedAt: performance.timeOrigin + performance.now() };
      } catch (error) { return { error: String(error), progress, startedAt, endedAt: performance.timeOrigin + performance.now() }; }
      finally { clearTimeout(timer); provider.stop(); }
    });
    const references = {};
    for (const direction of ['download', 'upload']) {
      const records = reference.snapshot(`${run}-${direction}`);
      // End-to-end directional active period, excluding the idle probe phase.
      const start = output.progress.find(p => p.phase === direction)?.t;
      const end = output.progress.filter(p => p.phase === direction).at(-1)?.t;
      references[direction] = { deliveredTrace: records, firstProgressAt: start, lastProgressAt: end,
        configuredRateMbps: scenario === 'steady' || scenario === 'asymmetric' || scenario === 'latency' ? scenarios[scenario].rate(0, direction) : null };
    }
    outcomes.push({ scenario, ...output, references });
    console.log(`${scenario}: v4 full Quick/Cloudflare path ${output.error ?? `${output.result.downloadSpeed.toFixed(2)} down / ${output.result.uploadSpeed.toFixed(2)} up Mbps`}`);
    await page.close();
  }
} finally {
  await browser.close(); await reference.close(); await mkdir('evidence/v5', { recursive: true });
  await writeFile(`evidence/v5/v4-acquisition-${browserName}.json`, JSON.stringify({ capturedAt: new Date().toISOString(), browserVersion: browser.version(), referenceSource: 'Unmodified v4 Cloudflare provider and AggregatedProvider from 285b803; unchanged @cloudflare/speedtest 1.11.0. Only fetch destinations and matching Resource Timing lookup are redirected to loopback.', limitations: 'Quick with consent declined isolates the common Cloudflare baseline. TURN and all non-reference requests are refused. v4 retains its own schedule, buffering, percentile processing and 25-second provider cap. Bursty/stalled paths have no single fixed configured rate; server receipt traces are retained for analysis. This is not a full M-Lab/physical-path comparison.', outcomes }, null, 2) + '\n');
}
