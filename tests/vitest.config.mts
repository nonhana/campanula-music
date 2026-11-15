import process from 'node:process';

import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

import { discoverTests, ROOT } from './suites.ts';

const suites = discoverTests();
const suite = process.env.CAMPANULA_TEST_SUITE ?? 'all';
if (suite !== 'all' && !(suite in suites))
  throw new Error(`未知套件：${suite}`);

export default defineConfig({
  root: ROOT,
  cacheDir: '.reports/vitest-cache',
  plugins: [sveltekit({ outDir: '.svelte-kit-vitest' })],
  test: {
    include: suite === 'all' ? Object.values(suites).flat() : suites[suite],
    // 精准 V8 采集下，冷启动曲库的 HTTP 和本机保存会超过默认 5 秒；业务时间仍由受控时钟推进。
    testTimeout: 15_000,
    // World 和 mock 自检仍共用 Kit 的测试输出目录，环境隔离迁移后再开放文件并行。
    fileParallelism: false,
    coverage: {
      provider: 'custom',
      customProviderModule: './tests/coverage/runtime.ts',
      include: [
        'src/**/*.ts',
        'src/**/*.svelte',
        'tests/_kit/**/*.ts',
        'tests/tools/**/*.mts',
        'tests/suites.ts',
        'tests/coverage/**/*.ts',
      ],
      exclude: ['**/*.d.ts'],
      reportsDirectory:
        process.env.CAMPANULA_COVERAGE_DIR ?? '.reports/coverage',
      reporter: ['json', 'json-summary', 'html'],
    },
  },
});
