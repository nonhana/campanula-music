import { spawn } from 'node:child_process';
import { globSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import type AxeBuilder from '@axe-core/playwright';

import baseline from '../baselines/browser-100.json' with { type: 'json' };
import { ROOT, sourceSha } from '../suites.ts';
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
const args = process.argv
  .slice(2)
  .filter((arg) => arg !== '--' && arg !== '--verify-retry');
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
  if (!args.length && !verifyRetry) {
    const cases: {
      file: string;
      name: string;
      project: string;
      status: string;
    }[] = [];
    const collect = (suites: typeof results.suites) => {
      for (const suite of suites) {
        for (const spec of suite.specs ?? [])
          for (const test of spec.tests)
            cases.push({
              file: suite.file,
              name: spec.title,
              project: test.projectName,
              status: test.status,
            });
        collect(suite.suites ?? []);
      }
    };
    collect(results.suites);
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
          code === 0 && !args.length && !verifyRetry,
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
  }),
);
if (process.env.CAMPANULA_PARENT_RUN)
  await writeFile(
    join(process.env.CAMPANULA_PARENT_RUN, 'browser.json'),
    JSON.stringify({ report, status: code === 0 ? 'passed' : 'failed' }),
  );
await writeFile(join(root, 'latest.json'), JSON.stringify({ report, code }));
process.exitCode = code;
