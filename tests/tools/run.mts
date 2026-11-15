import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import type { TestReport } from '../suites.ts';
import {
  compareMigration,
  comparePrevious,
  discoverTests,
  ROOT,
} from '../suites.ts';

const [suite = 'all', ...args] = process.argv
  .slice(2)
  .filter((arg) => arg !== '--');
const suites = discoverTests();
if (suite !== 'all' && !(suite in suites))
  throw new Error(`未知套件：${suite}`);
if (suite === 'browser' || suite === 'a11y') {
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(import.meta.resolve('tsx/cli')),
      'tests/tools/browser.mts',
      ...(args.some((arg) => arg.endsWith('.ts')) ? [] : suites[suite]),
      ...args,
    ],
    { cwd: ROOT, env: process.env, stdio: 'inherit' },
  );
  const code = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  process.exit(code);
}
const full = suite === 'all' && args.every((arg) => arg === '--coverage');
const runs = join(ROOT, '.reports/runs');
await mkdir(runs, { recursive: true });
const runRoot = await mkdtemp(join(runs, 'run-'));
const reportDir = join(runRoot, suite);
const coverageDir = join(runRoot, 'coverage');
await mkdir(reportDir, { recursive: true });
const output = join(reportDir, 'tests.json');
const kind =
  process.env.CAMPANULA_COVERAGE_CALIBRATE === '1' ? 'calibration' : suite;
const publish = async (status: string) => {
  const manifest = JSON.stringify(
    {
      status,
      suite,
      args,
      runRoot,
      reportDir,
      coverageDir,
      browser: await readFile(join(runRoot, 'browser.json'), 'utf8').then(
        JSON.parse,
        () => null,
      ),
    },
    null,
    2,
  );
  await writeFile(join(runRoot, 'run.json'), manifest);
  const temporary = `${runRoot}.json`;
  await writeFile(temporary, manifest);
  await rename(temporary, join(ROOT, '.reports', `latest-${kind}.json`));
};
await publish('running');
console.log(`本次测试报告：${runRoot}`);
const child = spawn(
  process.execPath,
  [
    fileURLToPath(new URL('../vitest.mjs', import.meta.resolve('vitest'))),
    'run',
    '--config',
    'tests/vitest.config.mts',
    '--configLoader',
    'native',
    '--reporter=default',
    '--reporter=json',
    `--outputFile.json=${output}`,
    ...args,
  ],
  {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      TSX_DISABLE_CACHE: '1',
      CAMPANULA_COVERAGE_DIR: coverageDir,
      CAMPANULA_COVERAGE_CALIBRATE: process.env.CAMPANULA_COVERAGE_CALIBRATE,
      CAMPANULA_TEST_SUITE: suite,
      CAMPANULA_TEST_FULL: full ? '1' : '0',
    },
    stdio: 'inherit',
  },
);
const code = await new Promise<number>((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
});
if (code !== 0) {
  await publish('failed');
  process.exit(code);
}
let status = 'failed';
try {
  const report = JSON.parse(await readFile(output, 'utf8')) as TestReport;
  if (
    !report.testResults.some((file) =>
      file.assertionResults.some(
        (test) => test.status === 'passed' || test.status === 'failed',
      ),
    )
  )
    throw new Error('所选范围没有执行任何用例：检查文件路径和用例全名过滤条件');
  const bySuite = Object.fromEntries(
    Object.entries(suites).map(([name, files]) => [
      name,
      report.testResults
        .filter((file) => files.some((path) => join(ROOT, path) === file.name))
        .map((file) => ({
          file: file.name.slice(ROOT.length),
          tests: file.assertionResults.length,
          statuses: file.assertionResults.map((test) => test.status),
        })),
    ]),
  );
  await writeFile(
    join(reportDir, 'suites.json'),
    `${JSON.stringify(bySuite, null, 2)}\n`,
  );
  if (full) {
    const result = compareMigration(report);
    const previous = comparePrevious(report);
    await writeFile(
      join(reportDir, 'migration.json'),
      `${JSON.stringify({ ...result, previous }, null, 2)}\n`,
    );
    console.log(
      `旧用例逐项核对：${result.preserved} 条保留，${result.added.length} 条新增`,
    );
  }

  status = full ? 'running browser' : 'passed';
} finally {
  await publish(status);
}

if (full) {
  await publish('running browser');
  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.resolve('tsx/cli')), 'tests/tools/browser.mts'],
    {
      cwd: ROOT,
      env: { ...process.env, CAMPANULA_PARENT_RUN: runRoot },
      stdio: 'inherit',
    },
  );
  const code = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  await publish(code === 0 ? 'passed' : 'failed');
  process.exitCode = code;
}
