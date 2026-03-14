/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const { chromium } = require('@playwright/test');

const outputDir = 'C:/la-sentadita-hub/web/.artifacts/dashboard-hero';
const baseUrl = 'http://127.0.0.1:3001/__preview/dashboard-hero';

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  throw new Error(`Timeout waiting for ${url}`);
}

async function captureCase(browser, item) {
  const context = await browser.newContext({
    deviceScaleFactor: item.deviceScaleFactor,
    hasTouch: item.hasTouch,
    isMobile: item.isMobile,
    viewport: item.viewport,
  });
  const page = await context.newPage();

  await page.goto(item.url, { waitUntil: 'networkidle' });

  const widget = page.locator('section[aria-labelledby="dashboard-hero-heading"]');
  await widget.waitFor({ state: 'visible', timeout: 30000 });
  await widget.screenshot({
    path: path.join(outputDir, `${item.name}.png`),
  });

  await context.close();
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  await waitForUrl(`${baseUrl}/success`, 40000);

  const browser = await chromium.launch({ headless: true });
  const cases = [
    {
      name: 'desktop-success',
      url: `${baseUrl}/success`,
      viewport: { width: 1440, height: 960 },
      isMobile: false,
    },
    {
      name: 'mobile-success',
      url: `${baseUrl}/success`,
      viewport: { width: 393, height: 852 },
      isMobile: true,
      deviceScaleFactor: 2,
      hasTouch: true,
    },
    {
      name: 'desktop-loading',
      url: `${baseUrl}/loading`,
      viewport: { width: 1440, height: 960 },
      isMobile: false,
    },
    {
      name: 'desktop-partial-fallback',
      url: `${baseUrl}/partial`,
      viewport: { width: 1440, height: 960 },
      isMobile: false,
    },
    {
      name: 'desktop-error',
      url: `${baseUrl}/error`,
      viewport: { width: 1440, height: 960 },
      isMobile: false,
    },
  ];

  try {
    for (const item of cases) {
      await captureCase(browser, item);
      console.log(`captured:${item.name}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
