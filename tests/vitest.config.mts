import { resolve } from 'node:path';
import process from 'node:process';

import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';
import { defineConfig } from 'vitest/config';

import { createWorkspace } from './_kit/workspace.ts';
import { discoverTests, ROOT } from './suites.ts';

const suites = discoverTests();
const suite = process.env.CAMPANULA_TEST_SUITE ?? 'all';
if (suite !== 'all' && !(suite in suites))
  throw new Error(`未知套件：${suite}`);

export default defineConfig(async () => {
  const workspace = await createWorkspace();
  return {
    root: workspace.root,
    cacheDir: 'node_modules/.vite-vitest',
    plugins: [
      sveltekit(),
      { name: 'campanula:test-workspace', closeBundle: workspace.close },
    ],
    test: {
      include: (suite === 'all'
        ? Object.values(suites).flat()
        : suites[suite]
      ).map((file) => `${ROOT}${file}`),
      // 精准 V8 采集下，冷启动曲库的 HTTP 和本机保存会超过默认 5 秒；业务时间仍由受控时钟推进。
      testTimeout: 15_000,
      // 保留串行的受控时钟与覆盖率采集；隔离由独占工作根和 worker 保证。
      fileParallelism: false,
      coverage: {
        provider: 'custom',
        allowExternal: true,
        customProviderModule: `${ROOT}tests/coverage/runtime.ts`,
        include: [
          `${ROOT}src/**/*.ts`,
          `${ROOT}src/**/*.svelte`,
          `${ROOT}tests/_kit/**/*.ts`,
          `${ROOT}tests/tools/**/*.mts`,
          `${ROOT}tests/suites.ts`,
          `${ROOT}tests/coverage/**/*.ts`,
        ],
        exclude: ['**/*.d.ts'],
        reportsDirectory: process.env.CAMPANULA_COVERAGE_DIR
          ? resolve(ROOT, process.env.CAMPANULA_COVERAGE_DIR)
          : `${ROOT}.reports/coverage`,
        reporter: ['json', 'json-summary', 'html'],
      },
    },
  } satisfies UserConfig;
});
