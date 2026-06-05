#!/usr/bin/env node
const { chromium } = require('playwright');

const baseUrl = process.env.HMC_BASE_URL || 'http://127.0.0.1:19080';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(`${baseUrl}/demo-login`, { waitUntil: 'networkidle' });
  await page.goto(`${baseUrl}/app?view=research-runs`, { waitUntil: 'networkidle' });
  await page.getByTestId('research-create-form').waitFor({ timeout: 15000 });
  const lanesBefore = await page.getByTestId('research-lane-card').count();
  await page.getByRole('button', { name: /Create tracked research run/i }).click();
  await page.getByText(/Created tracked research run/i).waitFor({ timeout: 15000 });
  const panelStyles = await page.getByTestId('research-create-form').evaluate((el) => {
    const cs = window.getComputedStyle(el);
    const input = el.querySelector('input');
    const choice = el.querySelector('[data-testid="research-lane-checkbox"]');
    const inputCs = input ? window.getComputedStyle(input) : null;
    const choiceCs = choice ? window.getComputedStyle(choice) : null;
    return {
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      inputBackground: inputCs?.backgroundColor,
      inputColor: inputCs?.color,
      choiceBackground: choiceCs?.backgroundColor,
      choiceColor: choiceCs?.color,
    };
  });
  const output = {
    finalUrl: page.url(),
    hasCreateForm: await page.getByTestId('research-create-form').isVisible(),
    laneChoices: await page.getByTestId('research-lane-checkbox').count(),
    sourceChoices: await page.getByTestId('research-source-checkbox').count(),
    createdNotice: await page.getByText(/Created tracked research run/i).isVisible(),
    hasOpenParentTask: await page.getByText('Open parent task').count() > 0,
    panelStyles,
    createPanelIsLight: panelStyles.backgroundColor === 'rgb(255, 255, 255)' && panelStyles.inputBackground === 'rgb(255, 255, 255)' && panelStyles.choiceColor === 'rgb(29, 35, 48)',
    lanesAfter: await page.getByTestId('research-lane-card').count(),
    lanesBefore,
    consoleErrors: errors,
  };
  await browser.close();
  if (!output.hasCreateForm || output.laneChoices < 3 || output.sourceChoices < 3 || !output.createdNotice || !output.hasOpenParentTask || !output.createPanelIsLight || output.consoleErrors.length) {
    console.error(JSON.stringify(output));
    process.exit(1);
  }
  console.log(JSON.stringify(output));
})();
