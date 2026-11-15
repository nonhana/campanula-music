import process from 'node:process';

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: process.env.CAMPANULA_BROWSER_OUTPUT,
  reporter: [
    ['list'],
    [
      'json',
      { outputFile: `${process.env.CAMPANULA_BROWSER_REPORT}/tests.json` },
    ],
    [
      'html',
      {
        outputFolder: `${process.env.CAMPANULA_BROWSER_REPORT}/html`,
        open: 'never',
      },
    ],
  ],
  use: {
    browserName: 'chromium',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    trace: 'on',
    screenshot: 'on',
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    locale: 'zh-CN',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'phone',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
