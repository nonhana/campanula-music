import { join } from 'node:path';
import process from 'node:process';

import { defineConfig } from '@playwright/test';

import config from './playwright.config.ts';

export default defineConfig({
  ...config,
  testMatch: 'dev.spec.ts',
  outputDir: join(process.env.CAMPANULA_WEBSITE_REPORT!, 'dev-results'),
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile: join(
          process.env.CAMPANULA_WEBSITE_REPORT!,
          'dev-tests.json',
        ),
      },
    ],
  ],
  webServer: {
    ...config.webServer,
    command: 'node tests/website/dev-server.mts',
    url: 'http://127.0.0.1:4388',
  },
  use: { ...config.use, baseURL: 'http://127.0.0.1:4388' },
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
