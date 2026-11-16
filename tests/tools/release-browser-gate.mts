import { execFileSync } from 'node:child_process';
import { appendFileSync, globSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import process from 'node:process';

import type { JSONReport } from '@playwright/test/reporter';

import baseline from '../baselines/browser-100.json' with { type: 'json' };
import {
  browserCases,
  missingBrowserBaseline,
  verifyReleaseBrowserInventory,
} from '../ci/browser-inventory.ts';
import { sourceSha } from '../suites.ts';
import {
  readContrastReports,
  summarizeContrast,
} from './browser/contrast-report.ts';

const root = process.argv[2];
const sha = sourceSha();
const list: JSONReport = JSON.parse(
  execFileSync(
    'pnpm',
    [
      'exec',
      'playwright',
      'test',
      '--config',
      'tests/browser/playwright.config.ts',
      '--list',
      '--reporter=json',
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  ),
);
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const shards = await Promise.all(
  globSync('browser-*/run-*/run.json', { cwd: root }).map(async (file) => {
    const name = basename(dirname(dirname(file)));
    const dir = join(root, dirname(file));
    const manifest = read(join(root, file));
    if (manifest.status !== 'passed' || manifest.verifyRetry)
      throw new Error(`浏览器执行失败：${name}`);
    const result: JSONReport = read(join(dir, 'tests.json'));
    const contrast = await readContrastReports(dir);
    if (
      contrast.some((report) => !name.startsWith(`browser-${report.project}-`))
    )
      throw new Error(`对比度报告视口不符：${name}`);
    return {
      name,
      sha: manifest.sha,
      cases: browserCases(result.suites),
      contrast,
    };
  }),
);
const cases = verifyReleaseBrowserInventory(
  browserCases(list.suites),
  shards,
  sha,
);
const missing = missingBrowserBaseline(cases);
if (missing)
  throw new Error(
    `缺少浏览器基线：${missing.project} / ${missing.file} / ${missing.name}`,
  );
const contrast = summarizeContrast(
  shards.flatMap((s) => s.contrast),
  true,
);
const summary = {
  sha,
  status: 'passed',
  cases: cases.length,
  baseline: { commit: baseline.commit, preserved: baseline.cases.length },
  shards: shards.map((s) => ({ name: s.name, cases: s.cases.length })),
  contrast,
};
writeFileSync(join(root, 'summary.json'), JSON.stringify(summary, null, 2));
const message = `浏览器 ${cases.length} 条用例全部通过，保留历史基线 ${baseline.cases.length} 条，对比度 ${contrast.groups.length} 个组件的登记状态全部通过。`;
console.log(message);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
