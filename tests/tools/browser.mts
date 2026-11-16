import { spawn } from 'node:child_process';
import { globSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import type AxeBuilder from '@axe-core/playwright';

import baseline from '../baselines/browser-100.json' with { type: 'json' };
import { browserCases } from '../ci/browser-inventory.ts';
import { requireInventory } from '../ci/plan.ts';
import { discoverTests, ROOT, sourceSha } from '../suites.ts';
import { summarizeContrast } from './browser/contrast-report.ts';

type Scan = Awaited<ReturnType<AxeBuilder['analyze']>> & {
  scenario: string;
  project: string;
  test: string;
};

const sha = sourceSha();
const root = join(ROOT, '.reports/browser');
await mkdir(root, { recursive: true });
const report = await mkdtemp(join(root, 'run-'));
const verifyRetry = process.argv.includes('--verify-retry');
const completeA11y = process.argv.includes('--complete-a11y');
const args = process.argv
  .slice(2)
  .filter((arg) => !['--', '--verify-retry', '--complete-a11y'].includes(arg));
if (completeA11y) requireInventory(discoverTests().a11y, args);
console.log(`浏览器报告：${report}`);
const child = spawn(
  process.execPath,
  [
    fileURLToPath(import.meta.resolve('@playwright/test/cli')),
    'test',
    '--config',
    'tests/browser/playwright.config.ts',
    ...args,
  ],
  {
    cwd: ROOT,
    env: {
      ...process.env,
      CAMPANULA_VERIFY_RETRY: verifyRetry ? '1' : '0',
      CAMPANULA_BROWSER_REPORT: report,
      CAMPANULA_BROWSER_OUTPUT: join(report, 'results'),
    },
    stdio: 'inherit',
  },
);
let code = await new Promise<number>((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
});
if (code === 0) {
  const results = JSON.parse(
    await readFile(join(report, 'tests.json'), 'utf8'),
  );
  const cases = browserCases(results.suites);
  if (completeA11y) {
    try {
      const key = (file: string, project: string) =>
        JSON.stringify([file, project]);
      const expected = discoverTests().a11y.flatMap((file) =>
        ['desktop', 'phone'].map((project) =>
          key(file.replace('tests/browser/', ''), project),
        ),
      );
      requireInventory(expected, [
        ...new Set(cases.map(({ file, project }) => key(file, project))),
      ]);
      if (cases.some((test) => test.status !== 'expected'))
        throw new Error('完整 a11y 用例未全部通过');
    } catch (error) {
      code = 1;
      console.error(error);
    }
  }
  if (!args.length && !verifyRetry) {
    for (const expected of baseline.cases) {
      const matches = cases.filter(
        (item) =>
          item.file === expected.file &&
          item.name === expected.name &&
          item.project === expected.project,
      );
      if (matches.length !== 1 || matches[0].status !== 'expected') code = 1;
    }
    await writeFile(
      join(report, 'baseline.json'),
      JSON.stringify({
        commit: baseline.commit,
        preserved: baseline.cases.length,
        passed: code === 0,
      }),
    );
  }
  if (
    verifyRetry
      ? results.stats.flaky !== 1 ||
        results.stats.expected !== 0 ||
        results.stats.unexpected !== 0 ||
        results.stats.skipped !== 0
      : !results.stats.expected ||
        results.stats.unexpected ||
        results.stats.skipped ||
        results.stats.flaky
  )
    code = 1;
}
const scans = await Promise.all(
  globSync('results/**/axe-*.json', { cwd: report })
    .filter((file) => !file.includes('/attachments/'))
    .sort()
    .map(async (file) => {
      const scan = JSON.parse(
        await readFile(join(report, file), 'utf8'),
      ) as Scan;
      return {
        file,
        scenario: scan.scenario,
        project: scan.project,
        test: scan.test,
        violations: scan.violations,
        incomplete: scan.incomplete,
        bestPractice: [
          ...scan.violations,
          ...scan.incomplete,
          ...scan.passes,
        ].filter((rule) => rule.tags.includes('best-practice')),
      };
    }),
);
try {
  const contrast = await Promise.all(
    globSync('results/**/contrast-*.json', { cwd: report })
      .filter((file) => !file.includes('/attachments/'))
      .map(async (file) =>
        JSON.parse(await readFile(join(report, file), 'utf8')),
      ),
  );
  await writeFile(
    join(report, 'contrast-summary.json'),
    JSON.stringify(
      {
        sha,
        ...summarizeContrast(
          contrast,
          code === 0 && (completeA11y || (!args.length && !verifyRetry)),
        ),
      },
      null,
      2,
    ),
  );
} catch (error) {
  code = 1;
  await writeFile(
    join(report, 'contrast-summary.json'),
    JSON.stringify({ sha, status: 'failed', error: String(error) }, null, 2),
  );
  console.error(error);
}
await writeFile(
  join(report, 'a11y-summary.json'),
  JSON.stringify({ scans }, null, 2),
);
await writeFile(
  join(report, 'run.json'),
  JSON.stringify({
    status: code === 0 ? 'passed' : 'failed',
    sha,
    args,
    report,
    source: process.env.CAMPANULA_BROWSER_SOURCE,
    verifyRetry,
    completeA11y,
  }),
);
if (process.env.CAMPANULA_PARENT_RUN)
  await writeFile(
    join(process.env.CAMPANULA_PARENT_RUN, 'browser.json'),
    JSON.stringify({ report, status: code === 0 ? 'passed' : 'failed' }),
  );
await writeFile(join(root, 'latest.json'), JSON.stringify({ report, code }));
process.exitCode = code;
