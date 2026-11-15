import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import type { TestReport } from '../suites.ts';
import { compareMigration, discoverTests, ROOT } from '../suites.ts';

const [suite = 'all', ...args] = process.argv
  .slice(2)
  .filter((arg) => arg !== '--');
const suites = discoverTests();
if (suite !== 'all' && !(suite in suites))
  throw new Error(`未知套件：${suite}`);
const full = suite === 'all' && args.every((arg) => arg === '--coverage');
const reportDir = join(ROOT, '.reports', suite);
await mkdir(reportDir, { recursive: true });
const output = join(reportDir, 'tests.json');
for (const file of ['tests.json', 'suites.json', 'migration.json'])
  await rm(join(reportDir, file), { force: true });
const child = spawn(
  process.execPath,
  [
    fileURLToPath(new URL('../vitest.mjs', import.meta.resolve('vitest'))),
    'run',
    '--config',
    'tests/vitest.config.mts',
    '--reporter=default',
    '--reporter=json',
    `--outputFile.json=${output}`,
    ...args,
  ],
  {
    cwd: ROOT,
    env: {
      ...process.env,
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
if (code !== 0) process.exit(code);
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
  await writeFile(
    join(reportDir, 'migration.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(
    `旧用例逐项核对：${result.preserved} 条保留，${result.added.length} 条新增`,
  );
}
