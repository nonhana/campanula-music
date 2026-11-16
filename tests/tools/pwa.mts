import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { execa } from 'execa';

import { ROOT } from '../suites.ts';

const { values } = parseArgs({
  options: {
    sha: { type: 'string' },
    candidate: { type: 'string' },
    next: { type: 'string' },
    grep: { type: 'string' },
    project: { type: 'string' },
  },
});
if (!values.sha || !values.candidate || !values.next)
  throw new Error('需要 --sha、--candidate 与 --next');
await mkdir(join(ROOT, '.reports/pwa'), { recursive: true });
const report = await mkdtemp(join(ROOT, '.reports/pwa/run-'));
console.log(`生产 PWA 报告：${report}`);
const result = await execa(
  process.execPath,
  [
    join(ROOT, 'node_modules/@playwright/test/cli.js'),
    'test',
    '--config',
    'tests/delivery/pwa/playwright.config.ts',
    ...(values.grep ? ['--grep', values.grep] : []),
    ...(values.project ? ['--project', values.project] : []),
  ],
  {
    cwd: ROOT,
    env: {
      CAMPANULA_PWA_SHA: values.sha,
      CAMPANULA_PWA_CANDIDATE: resolve(values.candidate),
      CAMPANULA_PWA_NEXT: resolve(values.next),
      CAMPANULA_PWA_REPORT: report,
    },
    stdio: 'inherit',
    reject: false,
  },
);
const tests = await readFile(join(report, 'tests.json'), 'utf8').then(
  JSON.parse,
  () => null,
);
const passed =
  result.exitCode === 0 &&
  tests?.stats.expected > 0 &&
  !tests.stats.unexpected &&
  !tests.stats.flaky &&
  !tests.stats.skipped;
const summary = JSON.stringify(
  {
    sha: values.sha,
    status: passed ? 'passed' : 'failed',
    candidate: resolve(values.candidate),
    next: resolve(values.next),
    stats: tests?.stats,
    rerun: `pnpm test:pwa --sha ${values.sha} --candidate ${values.candidate} --next ${values.next}`,
  },
  null,
  2,
);
await writeFile(join(report, 'result.json'), summary);
if (process.env.CAMPANULA_DELIVERY_RUN)
  await writeFile(
    join(process.env.CAMPANULA_DELIVERY_RUN, 'pwa.json'),
    summary,
  );
process.exitCode = passed ? 0 : 1;
