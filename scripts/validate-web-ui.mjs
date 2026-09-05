// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.
import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startReference } from './controlled-reference.mjs';

const reference = await startReference(), evidence = [];
await mkdir('evidence/v5', { recursive: true });
try {
  for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await type.launch(name === 'chromium' ? { channel: 'chrome' } : {});
    try {
      const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'no-preference' }), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket('**', socket => socket.close());
      await page.addInitScript(({ reference }) => {
        localStorage.setItem('qubetx-speedtest-settings', JSON.stringify({ dataPolicyAccepted: false, testProfile: 'fast', autoCopyResults: false }));
        const original = window.fetch.bind(window);
        window.fetch = (input, options) => {
          const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
          if (url.hostname === 'speed.cloudflare.com' && ['/__down', '/__up'].includes(url.pathname)) {
            const target = new URL(reference + '/test' + url.search); target.searchParams.set('run', 'ui'); target.searchParams.set('scenario', 'steady');
            return original(target, options);
          }
          if (url.origin !== location.origin) return Promise.reject(new Error('Public requests disabled in UI fixture'));
          return original(input, options);
        };
      }, { reference: reference.url });
      await page.goto('http://127.0.0.1:5175/');
      const fits = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Page must not overflow horizontally');
      await fits(); await page.screenshot({ path: `evidence/v5/web-${name}-idle.png`, fullPage: true });
      await page.getByRole('button', { name: 'start speed test', exact: true }).click();
      await page.getByRole('button', { name: 'new test speed test', exact: true }).waitFor({ timeout: 45000 });
      await page.getByRole('button', { name: 'VIEW DETAILS +' }).click();
      await page.getByRole('heading', { name: 'Evidence and observed variation' }).waitFor();
      await fits(); await page.screenshot({ path: `evidence/v5/web-${name}-complete.png`, fullPage: true });
      await page.getByLabel('Inspect recorded throughput sample').fill('5');
      await page.getByRole('button', { name: /^ping,.*Show metric explanation/ }).click();
      await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').isVisible(), false);
      await page.getByRole('button', { name: 'new test speed test', exact: true }).click();
      await page.getByRole('button', { name: 'start speed test', exact: true }).click();
      await page.getByRole('button', { name: 'stop speed test', exact: true }).click();
      await page.getByText('Stopped · partial result', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'new test speed test', exact: true }).click();
      await page.getByRole('link', { name: 'Settings', exact: true }).click();
      await page.getByRole('button', { name: '250 MB', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: '250 MB', exact: true }).getAttribute('aria-pressed'), 'true');
      await fits(); await page.screenshot({ path: `evidence/v5/web-${name}-settings.png`, fullPage: true });
      await page.getByRole('link', { name: 'Back to test' }).click();
      for (const width of [320, 640, 1440]) { await page.setViewportSize({ width, height: 900 }); await fits(); }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByRole('button', { name: 'start speed test', exact: true }).click();
      await page.waitForTimeout(3000);
      const transforms = () => page.locator('.cassette-reel g[transform]').evaluateAll(elements => elements.map(element => element.getAttribute('transform')));
      const before = await transforms(); await page.waitForTimeout(300); assert.deepEqual(await transforms(), before);
      await page.getByRole('button', { name: 'stop speed test', exact: true }).click();
      await page.getByRole('button', { name: 'new test speed test', exact: true }).waitFor();
      assert.deepEqual(errors, []);
      evidence.push({ browser: name, version: browser.version(), widths: [320, 375, 640, 1440], errors, checks: ['complete result and details', 'trace inspection', 'metric dialog and Escape', 'stop and reset', 'data limit selection', 'horizontal fit', 'reduced motion'] });
      console.log(`${name}: live completion, stop, details, settings, responsive fit and reduced motion passed`);
    } finally { await browser.close(); }
  }
} finally {
  await reference.close();
  await writeFile('evidence/v5/web-ui.json', JSON.stringify({ capturedAt: new Date().toISOString(), kind: 'Actual website with loopback HTTP fixture', evidence }, null, 2) + '\n');
}
