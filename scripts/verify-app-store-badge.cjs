const { chromium, devices } = require('playwright');

async function checkBadge(label, contextOptions, expectedVisible, maxTouchPointsOverride) {
  const browser = await chromium.launch();
  const context = await browser.newContext(contextOptions);
  if (typeof maxTouchPointsOverride === 'number') {
    await context.addInitScript((value) => {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => value,
        configurable: true,
      });
    }, maxTouchPointsOverride);
  }
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(`PAGE ERROR: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`CONSOLE: ${msg.text()}`);
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  // Give React a tick to run effects
  await page.waitForTimeout(300);

  const badgeCount = await page.locator('img[alt="Download on the App Store"]').count();
  const copyrightCount = await page.locator('text=/\\u00a9 2026 QUBETX/').count();

  const actualVisible = badgeCount > 0;
  const pass = actualVisible === expectedVisible && copyrightCount === 1 && errors.length === 0;

  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${label}`);
  console.log(`  badge rendered: ${actualVisible} (expected ${expectedVisible})`);
  console.log(`  copyright rendered: ${copyrightCount === 1}`);
  if (errors.length) console.log(`  errors: ${errors.join('; ')}`);

  if (actualVisible) {
    const box = await page.locator('img[alt="Download on the App Store"]').first().boundingBox();
    console.log(`  badge box: ${JSON.stringify(box)}`);
  }

  await browser.close();
  return pass;
}

(async () => {
  const results = [];

  // Desktop: badge must NOT render
  results.push(await checkBadge(
    'Desktop (plain Chromium)',
    {},
    false,
  ));

  // iPhone: badge MUST render
  results.push(await checkBadge(
    'iPhone 13 emulation',
    devices['iPhone 13'],
    true,
  ));

  // iPad: badge MUST render (tests the masquerade detection).
  // Real iPadOS 13+ reports a Mac user agent AND navigator.maxTouchPoints === 5.
  // Playwright doesn't set maxTouchPoints, so we inject it via addInitScript.
  results.push(await checkBadge(
    'iPad (Mac UA + maxTouchPoints=5, masquerade)',
    {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
      hasTouch: true,
      viewport: { width: 1024, height: 1366 },
    },
    true,
    5,
  ));

  // Real Mac (Touch Bar or trackpad): must NOT render.
  // Same UA as above but maxTouchPoints === 0, which is what real Macs report.
  results.push(await checkBadge(
    'Real Mac (Mac UA + maxTouchPoints=0)',
    {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
      viewport: { width: 1440, height: 900 },
    },
    false,
    0,
  ));

  // Android: badge must NOT render
  results.push(await checkBadge(
    'Pixel 5 emulation (Android)',
    devices['Pixel 5'],
    false,
  ));

  const allPass = results.every(Boolean);
  console.log(`\n=== ${allPass ? 'ALL PASS' : 'SOME FAILED'} ===`);
  process.exit(allPass ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
