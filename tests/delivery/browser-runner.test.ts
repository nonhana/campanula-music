import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { execa } from 'execa';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { contrastReports as contrast } from '../_kit/contrast-reports.ts';
import baseline from '../baselines/browser-100.json' with { type: 'json' };
import inventory from '../baselines/contrast-audit.json' with { type: 'json' };
import { discoverTests, ROOT, sourceSha } from '../suites.ts';

const suites = discoverTests();
const cases = suites.a11y.flatMap((path) =>
  ['desktop', 'phone'].map((project) => ({
    file: path.replace('tests/browser/', ''),
    name: path,
    project,
    status: 'expected',
  })),
);
let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'campanula-browser-runner-'));
  for (const file of Object.values(suites).flat()) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), '');
  }
  for (const file of [
    'tests/suites.ts',
    'tests/tools/run.mts',
    'tests/tools/browser.mts',
    'tests/tools/browser/contrast-report.ts',
    'tests/ci/browser-inventory.ts',
    'tests/ci/plan.ts',
    'tests/baselines',
  ]) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await cp(join(ROOT, file), join(root, file), { recursive: true });
  }
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ type: 'module' }),
  );
  await mkdir(join(root, 'node_modules/@playwright/test'), { recursive: true });
  await symlink(
    dirname(fileURLToPath(import.meta.resolve('tsx/package.json'))),
    join(root, 'node_modules/tsx'),
  );
  await writeFile(
    join(root, 'node_modules/@playwright/test/package.json'),
    JSON.stringify({
      type: 'module',
      exports: { './cli': './cli.mjs' },
    }),
  );
  await cp(
    join(ROOT, 'tests/_kit/playwright-report.mjs'),
    join(root, 'node_modules/@playwright/test/cli.mjs'),
  );
});
afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

const run = async (
  args: string[] = [],
  input = { cases, contrast: contrast() },
  command = 'run.mts',
) => {
  const inputPath = join(root, 'input.json');
  await writeFile(inputPath, JSON.stringify(input));
  const child = await execa(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      join(root, 'tests/tools', command),
      ...args,
    ],
    {
      cwd: root,
      env: {
        CAMPANULA_TEST_SHA: sourceSha(),
        CAMPANULA_PLAYWRIGHT_REPORT: inputPath,
      },
      reject: false,
      timeout: 10_000,
    },
  );
  const report = /浏览器报告：([^\n]+)/.exec(child.stdout)?.[1];
  expect(report, child.all ?? child.stderr).toBeDefined();
  const read = async (file: string) =>
    JSON.parse(await readFile(join(report!, file), 'utf8'));
  return {
    code: child.exitCode,
    stderr: child.stderr,
    summary: await read('contrast-summary.json'),
    manifest: await read('run.json'),
    args: await read('playwright-args.json'),
  };
};

describe('浏览器专项 CLI 的完整性', () => {
  it('完整 a11y 入口核对所有登记组和状态，并输出完整通过', async () => {
    const result = await run(['a11y']);
    expect(result.code, result.stderr).toBe(0);
    expect(result.summary.status).toBe('passed');
    expect(result.summary.missing).toEqual([]);
    expect(result.args).not.toContain('--complete-a11y');
  });

  it('完整 a11y 缺少组件组或规定状态时阻断，即使 Playwright 全绿', async () => {
    const missingGroup = contrast().map((report) => ({
      ...report,
      result: report.result.filter((row) => row.id !== 'daily-number.icon'),
    }));
    const group = inventory.groups.find(
      (group) => group.requiredStates.length > 1,
    )!;
    const missingState = contrast().map((report) => ({
      ...report,
      result: report.result.filter(
        (row) =>
          row.id !== group.id ||
          `${report.project}:${report.state}` !== group.requiredStates[0],
      ),
    }));
    for (const [data, error] of [
      [missingGroup, 'components not measured'],
      [missingState, 'state not measured'],
    ] as const) {
      const result = await run(['a11y'], { cases, contrast: data });
      expect(result.code).toBe(1);
      expect(result.summary.status).toBe('failed');
      expect(result.summary.error).toContain(error);
    }
  });

  it('完整 a11y 缺文件、缺视口、跳过或空执行都不能通过', async () => {
    for (const selected of [
      cases.filter((item) => item.file !== cases[0].file),
      cases.filter(
        (item) => item.file !== cases[0].file || item.project !== 'phone',
      ),
      cases.map((item, index) =>
        index === 0 ? { ...item, status: 'skipped' } : item,
      ),
      [],
    ]) {
      const result = await run(['a11y'], {
        cases: selected,
        contrast: contrast(),
      });
      expect(result.code).toBe(1);
      expect(result.manifest.status).toBe('failed');
    }
  });

  it('单文件、名称和视口的选择都不冒充完整专项', async () => {
    for (const args of [
      ['tests/browser/accessibility/controls.spec.ts'],
      ['--grep', '全页扫描'],
      ['--project=desktop'],
    ]) {
      const result = await run(['a11y', ...args], {
        cases: cases.slice(0, 1),
        contrast: contrast().slice(0, 1),
      });
      expect(result.code, result.stderr).toBe(0);
      expect(result.summary.status).toBe('partial');
      expect(result.manifest.args).not.toContain('--complete-a11y');
    }
  });

  it('部分选择没有执行或全部跳过时同样阻断', async () => {
    for (const selected of [[], [{ ...cases[0], status: 'skipped' }]]) {
      const result = await run(['a11y', '--project=desktop'], {
        cases: selected,
        contrast: [],
      });
      expect(result.code).toBe(1);
      expect(result.manifest.status).toBe('failed');
      expect(result.summary.status).not.toBe('passed');
    }
  });

  it('原无参完整浏览器仍检查旧用例及完整对比度', async () => {
    const all = baseline.cases.map((item) => ({ ...item, status: 'expected' }));
    const success = await run(
      [],
      { cases: all, contrast: contrast() },
      'browser.mts',
    );
    expect(success.code, success.stderr).toBe(0);
    expect(success.summary.status).toBe('passed');
    const incomplete = await run(
      [],
      { cases: all, contrast: [] },
      'browser.mts',
    );
    expect(incomplete.code).toBe(1);
    const missing = await run(
      [],
      { cases: all.slice(1), contrast: contrast() },
      'browser.mts',
    );
    expect(missing.code).toBe(1);
    const duplicate = await run(
      [],
      {
        cases: [...all, { ...all[0], status: 'skipped' }],
        contrast: contrast(),
      },
      'browser.mts',
    );
    expect(duplicate.code).toBe(1);
    const baselineReport = JSON.parse(
      await readFile(join(duplicate.manifest.report, 'baseline.json'), 'utf8'),
    );
    expect(baselineReport.passed).toBe(false);
  });
});
