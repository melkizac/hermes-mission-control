#!/usr/bin/env node
/* Real no-submit browser funnel probe for Mission Control Phase 13.
 * Opens a safe public URL with Playwright, captures a screenshot, detects forms and
 * submit candidates, and exits without clicking/submitting anything.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function main() {
  const url = process.argv[2];
  const screenshotDir = process.argv[3] || "/tmp/hmc-browser-funnel-check";
  const timeoutMs = Number(process.argv[4] || 20000);
  if (!url) throw new Error("URL argument required");
  fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, `funnel-${Date.now()}.png`);

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 8000) }).catch(() => {});
    const title = await page.title();
    const finalUrl = page.url();
    const forms = await page.$$eval("form", (nodes) => nodes.map((form, index) => ({
      index,
      action: form.getAttribute("action") || "",
      method: (form.getAttribute("method") || "get").toLowerCase(),
      inputs: form.querySelectorAll("input, textarea, select").length,
      submitButtons: form.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])').length,
      text: (form.innerText || "").slice(0, 300),
    })));
    const submitCandidates = await page.$$eval('button[type="submit"], input[type="submit"], form button:not([type])', (nodes) => nodes.length);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await browser.close();
    console.log(JSON.stringify({
      ok: true,
      url,
      finalUrl,
      domain: new URL(finalUrl).hostname.replace(/^www\./, ""),
      title,
      screenshotPath,
      forms,
      formsCount: forms.length,
      submitCandidates,
      noSubmit: true,
    }));
  } catch (error) {
    await browser.close().catch(() => {});
    console.log(JSON.stringify({ ok: false, url, error: String(error && error.message || error), noSubmit: true }));
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error && error.stack || String(error));
  process.exit(1);
});
