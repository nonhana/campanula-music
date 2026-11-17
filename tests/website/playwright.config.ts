import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { defineConfig } from '@playwright/test';

import { ROOT } from '../suites.ts';

const reports = join(ROOT, '.reports/website');
mkdirSync(reports, { recursive: true });
const report =
  process.env.CAMPANULA_WEBSITE_REPORT ??
  (process.env.CAMPANULA_PARENT_RUN
    ? join(process.env.CAMPANULA_PARENT_RUN, 'website')
    : mkdtempSync(join(reports, 'run-')));
process.env.CAMPANULA_WEBSITE_REPORT = report;
mkdirSync(report, { recursive: true });

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: join(report, 'results'),
  reporter: [
    ['list'],
    ['json', { outputFile: join(report, 'tests.json') }],
    ['./reporter.ts', { report }],
  ],
  webServer: {
    cwd: ROOT,
    command: 'node tests/website/server.mts',
    url: 'http://127.0.0.1:4387',
    reuseExistingServer: false,
    timeout: 30_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
  use: {
    baseURL: 'http://127.0.0.1:4387',
    browserName: 'chromium',
    serviceWorkers: 'allow',
    locale: 'zh-CN',
    reducedMotion: 'reduce',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    trace: 'on',
    screenshot: 'on',
  },
  projects: [
    {
      name: 'artifact',
      testMatch: 'artifact.spec.ts',
      use: { javaScriptEnabled: false },
    },
    {
      name: 'desktop',
      testIgnore: 'artifact.spec.ts',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'phone',
      testIgnore: 'artifact.spec.ts',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
