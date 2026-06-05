#!/usr/bin/env node
/* Mobile Operator Hardening regression probe.
 * Usage: MISSION_CONTROL_URL=https://hermes.melverick.com node scripts/phase6-mobile-regression-probe.cjs
 */
const { chromium } = require('playwright');

const base = process.env.MISSION_CONTROL_URL || 'http://127.0.0.1:19080';
const viewport = { width: 390, height: 844 };
const views = [
  { name: 'Mission Control', url: '/app?view=mission', selector: 'text=Mission Control' },
  { name: 'Task Board', url: '/app?view=board', selector: 'text=Task Board' },
  { name: 'Approval Gates', url: '/app?view=approvals', selector: 'text=Approval Gates' },
  { name: 'Projects', url: '/app?view=projects', selector: 'text=Projects' },
  { name: 'My Agents', url: '/app?view=agents&agent=melkizac', selector: '[data-deeplink-target="agent-chat"]' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport, isMobile: true });
  const results = [];
  try {
    await page.goto(`${base}/demo-login`, { waitUntil: 'networkidle' });
    for (const view of views) {
      await page.goto(`${base}${view.url}`, { waitUntil: 'networkidle' });
      await page.waitForSelector(view.selector, { timeout: 10000 });
      const metrics = await page.evaluate(() => {
        const horizontalOverflow = document.documentElement.scrollWidth > window.innerWidth + 2;
        const bottomNav = document.querySelector('.mobile-nav, .bottom-nav, nav[aria-label="Mobile navigation"]');
        const composer = document.querySelector('textarea, input');
        const navRect = bottomNav?.getBoundingClientRect?.();
        const composerRect = composer?.getBoundingClientRect?.();
        const bottomNavOverlap = Boolean(navRect && navRect.top < window.innerHeight && navRect.left < window.innerWidth && navRect.width > 0);
        const composerCovered = Boolean(navRect && composerRect && composerRect.bottom > navRect.top && composerRect.top < navRect.bottom);
        return { horizontalOverflow, bottomNavOverlap, composerCovered, width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth };
      });
      results.push({ view: view.name, ...metrics });
      if (metrics.horizontalOverflow || metrics.composerCovered) throw new Error(`${view.name} mobile regression: ${JSON.stringify(metrics)}`);
    }
    console.log(JSON.stringify({ ok: true, viewport, results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
