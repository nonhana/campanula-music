import process from 'node:process';

import { defineConfig } from '@playwright/test';

const report = process.env.CAMPANULA_PWA_REPORT;
if (!report) throw new Error('请使用 pnpm test:pwa，确保报告进入独占目录');

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  outputDir: `${report}/results`,
  reporter: [
    ['list'],
    ['json', { outputFile: `${report}/tests.json` }],
    [
      'html',
      {
        outputFolder: `${report}/html`,
        open: 'never',
      },
    ],
  ],
  use: {
    browserName: 'chromium',
    serviceWorkers: 'allow',
    reducedMotion: 'reduce',
    locale: 'zh-CN',
    trace: 'on',
    screenshot: 'on',
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
