#!/usr/bin/env node
const { chromium } = require('playwright');

const baseUrl = process.env.HMC_BASE_URL || 'http://127.0.0.1:19080';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto(`${baseUrl}/demo-login`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => {});
  await page.goto(`${baseUrl}/app?view=research-runs`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="research-run-card"]', { timeout: 20000 });
  const drawerBeforeClick = await page.locator('[data-testid="research-detail-drawer"]').count();
  await page.locator('[data-testid="research-run-card"]').first().click();
  await page.waitForSelector('[data-testid="research-detail-drawer"]', { timeout: 20000 });
  await page.waitForSelector('[data-testid="research-lane-card"]', { timeout: 20000 });

  const result = await page.evaluate((drawerBeforeClick) => {
    const text = document.body.textContent || '';
    return {
      finalUrl: location.href,
      hasResearchCommandCenter: text.includes('Research command center'),
      hasParallelResearchLanes: text.includes('Parallel research lanes'),
      hasSourceCoverage: text.includes('Source coverage'),
      hasSynthesisProgress: text.includes('Synthesis progress'),
      hasFinalEvidence: text.includes('Final synthesis / recommendation evidence'),
      runCards: document.querySelectorAll('[data-testid="research-run-card"]').length,
      drawerBeforeClick,
      drawerOpen: document.querySelectorAll('[data-testid="research-detail-drawer"]').length === 1,
      laneCards: document.querySelectorAll('[data-testid="research-lane-card"]').length,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  }, drawerBeforeClick);
  console.log(JSON.stringify({ ...result, consoleErrors }, null, 2));
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
