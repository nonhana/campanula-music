import { globSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

import { execa } from 'execa';

import baseline from '../baselines/browser-100.json' with { type: 'json' };
import { browserCases } from '../ci/browser-inventory.ts';
import { dailyPlan, requireInventory } from '../ci/plan.ts';
import type { Lane } from '../ci/plan.ts';
import {
  compareIssue100,
  comparePrevious,
  ROOT,
  sourceSha,
} from '../suites.ts';
import type { ContrastReport } from './browser/contrast-report.ts';

const input = process.argv[2]?.startsWith('{') ? process.argv[2] : undefined;
const lane: Lane | undefined = input
  ? JSON.parse(input)
  : dailyPlan(null).find((l) => l.name === process.argv[2]);
if (!lane) throw new Error('请选择日常 CI 中的一个任务');
const sha = sourceSha();
const output = join(ROOT, '.reports/daily');
await mkdir(output, { recursive: true });
const work = await mkdtemp(join(output, `${lane.name}-`));
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const pnpm = (...args: string[]) =>
  execa('pnpm', args, {
    stdio: 'inherit',
    cwd: ROOT,
    env: { CAMPANULA_PARENT_RUN: work },
  });
let cases = 0;
let contrast: ContrastReport[] = [];
if (lane.files.length && !lane.project) {
  const listed = join(work, 'listed.json');
  await pnpm(
    'exec',
    'vitest',
    'list',
    '--config',
    'tests/vitest.config.mts',
    '--configLoader',
    'native',
    '--no-staticParse',
    `--json=${listed}`,
    ...lane.files,
  );
  await pnpm('exec', 'tsx', 'tests/tools/run.mts', 'all', ...lane.files);
  const manifest = await json(join(work, 'vitest.json'));
  if (manifest.sha !== sha || manifest.status !== 'passed')
    throw new Error('测试报告与候选不符');
  const result = await json(join(manifest.reportDir, 'tests.json'));
  comparePrevious(result, lane.files);
  compareIssue100(result, lane.files);
  const key = (file: string, name: string) =>
    JSON.stringify([relative(ROOT, file), name]);
  const files = result.testResults as {
    name: string;
    assertionResults: {
      ancestorTitles: string[];
      title: string;
      status: string;
    }[];
  }[];
  requireInventory(
    lane.files,
    files.map((f) => relative(ROOT, f.name)),
  );
  const ids = files.flatMap((f) =>
    f.assertionResults.map((t) => {
      if (t.status !== 'passed') throw new Error(`用例未通过：${t.title}`);
      return key(f.name, [...t.ancestorTitles, t.title].join(' > '));
    }),
  );
  const expected = (await json(listed)) as { file: string; name: string }[];
  requireInventory(
    expected.map((t) => key(t.file, t.name)),
    ids,
  );
  cases = ids.length;
} else if (lane.project) {
  const args = [...lane.files, '--project', lane.project];
  const listed = join(work, 'listed.json');
  await execa(
    'pnpm',
    [
      'exec',
      'playwright',
      'test',
      '--config',
      'tests/browser/playwright.config.ts',
      '--list',
      '--reporter=json',
      ...args,
    ],
    { env: { PLAYWRIGHT_JSON_OUTPUT_FILE: listed }, stdio: 'inherit' },
  );
  await pnpm('exec', 'tsx', 'tests/tools/browser.mts', ...args);
  const { report } = await json(join(work, 'browser.json'));
  const manifest = await json(join(report, 'run.json'));
  if (manifest.sha !== sha || manifest.status !== 'passed')
    throw new Error('浏览器报告与候选不符');
  const actual = browserCases((await json(join(report, 'tests.json'))).suites);
  const expected = browserCases((await json(listed)).suites);
  requireInventory(lane.files, [
    ...new Set(actual.map((t) => `tests/browser/${t.file}`)),
  ]);
  requireInventory(
    expected.map((t) => t.id),
    actual.map((t) => t.id),
  );
  for (const t of baseline.cases.filter(
    (t) =>
      t.project === lane.project &&
      lane.files.includes(`tests/browser/${t.file}`),
  ))
    if (
      !actual.some(
        (a) =>
          a.name === t.name && a.file === t.file && a.project === t.project,
      )
    )
      throw new Error(`缺少浏览器基线：${t.name}`);
  if (actual.some((t) => t.status !== 'expected' || t.project !== lane.project))
    throw new Error('浏览器用例未全部通过');
  if (lane.name.startsWith('contrast-'))
    contrast = await Promise.all(
      globSync('results/**/contrast-*.json', { cwd: report })
        .filter((f) => !f.includes('/attachments/'))
        .map((f) => json(join(report, f))),
    );
  cases = actual.length;
} else if (lane.name === 'static') {
  await pnpm('test:ci', 'static');
  const candidate = join(work, 'vercel');
  await pnpm(
    'build:delivery',
    '--sha',
    sha,
    '--adapter',
    'vercel',
    '--out',
    candidate,
  );
  await pnpm(
    'test:delivery',
    '--sha',
    sha,
    '--adapter',
    'vercel',
    '--candidate',
    candidate,
  );
} else {
  await pnpm('test:ci', lane.name);
}
await writeFile(
  join(output, `${lane.name}.json`),
  JSON.stringify({ sha, name: lane.name, files: lane.files, cases, contrast }),
);
