#!/usr/bin/env node
const { chromium } = require('playwright');

const baseUrl = process.env.HMC_BASE_URL || 'http://127.0.0.1:19080';
const sessionCookie = process.env.HMC_SESSION_COOKIE || '';
const width = 390;
const height = 844;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  if (sessionCookie) {
    await context.addCookies([{ name: 'mission_control_session', value: sessionCookie, domain: new URL(baseUrl).hostname, path: '/', httpOnly: false, secure: baseUrl.startsWith('https') }]);
  }
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  if (!sessionCookie) {
    await page.goto(`${baseUrl}/demo-login`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
  }
  await page.goto(`${baseUrl}/app?view=mission`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const dock = document.querySelector('[data-testid="mobile-operator-dock"]');
    const actions = [...document.querySelectorAll('[data-testid="mobile-operator-action"]')];
    const labels = actions.map((button) => button.textContent || '');
    const doc = document.documentElement;
    const horizontalOverflow = doc.scrollWidth > doc.clientWidth + 1;
    const firstPanel = document.querySelector('.dash-panel');
    const dockRect = dock?.getBoundingClientRect();
    const panelRect = firstPanel?.getBoundingClientRect();
    const dockOverlapsMainAction = Boolean(dockRect && panelRect && dockRect.top < panelRect.bottom && dockRect.bottom > panelRect.top);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      dockVisible: Boolean(dock && getComputedStyle(dock).display !== 'none'),
      actionCount: actions.length,
      labels,
      hasNeedsAttention: labels.some((label) => label.includes('Needs Attention')),
      hasRunningNow: labels.some((label) => label.includes('Running Now')),
      hasBrowserActivity: labels.some((label) => label.includes('Browser Activity')),
      hasProjects: labels.some((label) => label.includes('Projects')),
      horizontalOverflow,
      dockOverlapsMainAction,
    };
  });

  const browserAction = page.locator('[data-testid="mobile-operator-action"]', { hasText: 'Browser Activity' }).first();
  if (await browserAction.count()) await browserAction.click();
  await page.waitForTimeout(400);
  const afterBrowserClick = await page.evaluate(() => document.body.textContent?.includes('Browser operation visibility') || document.body.textContent?.includes('Browser Activity'));

  await page.goto(`${baseUrl}/app?view=mission`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const projectsAgain = page.locator('[data-testid="mobile-operator-action"]', { hasText: 'Projects' }).first();
  if (await projectsAgain.count()) await projectsAgain.click();
  await page.waitForTimeout(400);
  const afterProjectsClick = await page.evaluate(() => document.body.textContent?.includes('Projects'));

  await browser.close();
  const output = { ...result, afterBrowserClick, afterProjectsClick, consoleErrors: errors };
  console.log(JSON.stringify(output, null, 2));
  if (!output.dockVisible || output.actionCount < 5 || output.horizontalOverflow || output.dockOverlapsMainAction || !afterBrowserClick || !afterProjectsClick || errors.length) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
