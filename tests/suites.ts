import { globSync } from 'node:fs';
import { matchesGlob, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import previous from './baselines/issue-99.json' with { type: 'json' };
import baseline from './baselines/migration.json' with { type: 'json' };

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const SUITES = {
  unit: ['tests/unit/**/*.test.ts'],
  behavior: ['tests/behavior/**/*.test.ts'],
  contract: ['tests/contract/**/*.test.ts'],
  delivery: ['tests/delivery/**/*.test.ts'],
  browser: ['tests/browser/journeys/**/*.spec.ts'],
  a11y: ['tests/browser/accessibility/**/*.spec.ts'],
};
export const selectTests = (
  files: string[],
  suites: Record<string, string[]> = SUITES,
  required = [
    ...baseline.migrations.map(({ to }) => to),
    ...[
      'core',
      'diagnostics',
      'downloads',
      'environment',
      'keyboard',
      'login',
      'player',
      'save',
      'states',
    ].map((name) => `tests/browser/journeys/${name}.spec.ts`),
    'tests/browser/accessibility/pages.spec.ts',
    'tests/browser/accessibility/controls.spec.ts',
  ],
) => {
  const selected: Record<string, string[]> = {};
  for (const [suite, patterns] of Object.entries(suites)) {
    selected[suite] = [];
    for (const pattern of patterns) {
      const matching = files.filter((file) => matchesGlob(file, pattern));
      if (!matching.length)
        throw new Error(`套件 ${suite} 选择为空：${pattern}`);
      selected[suite].push(...matching);
    }
  }
  for (const file of files) {
    const owners = Object.values(selected)
      .flat()
      .filter((item) => item === file);
    if (owners.length !== 1)
      throw new Error(`${file} 应归属一个套件，实际归属 ${owners.length} 次`);
  }
  for (const file of required) {
    if (!files.includes(file)) throw new Error(`缺少必需测试文件：${file}`);
  }
  return selected;
};

export const discoverTests = () =>
  selectTests(
    globSync(['tests/**/*.test.ts', 'tests/**/*.spec.ts'], {
      cwd: ROOT,
    }).sort(),
  );

export interface TestReport {
  testResults: {
    name: string;
    assertionResults: { fullName: string; status: string }[];
  }[];
}

export const compareMigration = (report: TestReport) => {
  const actual = report.testResults.flatMap((file) =>
    file.assertionResults.map((test) => ({
      file: relative(ROOT, file.name),
      name: test.fullName,
      status: test.status,
    })),
  );
  const expected = baseline.migrations.flatMap(({ to, cases }) =>
    cases.map((test) => ({ file: to, ...test })),
  );
  for (const test of expected) {
    const matches = actual.filter(
      (item) => item.file === test.file && item.name === test.name,
    );
    if (matches.length !== 1 || matches[0]?.status !== test.status)
      throw new Error(
        `旧用例迁移不一致：${test.file} > ${test.name}（原 ${test.status}，现 ${matches.map(({ status }) => status).join(',') || '缺失'}）`,
      );
  }
  const added = actual.filter(
    (test) =>
      !expected.some(
        (item) => item.file === test.file && item.name === test.name,
      ),
  );
  return { baseline: baseline.commit, preserved: expected.length, added };
};

export const comparePrevious = (report: TestReport) => {
  const expected = [
    ...baseline.migrations.flatMap(({ to, cases }) =>
      cases.map((test) => ({ file: to, ...test })),
    ),
    ...previous.cases,
  ];
  const actual = report.testResults.flatMap((file) =>
    file.assertionResults.map((item) => ({
      file: relative(ROOT, file.name),
      name: item.fullName,
      status: item.status,
    })),
  );
  for (const test of expected) {
    const matches = actual.filter(
      (item) => item.file === test.file && item.name === test.name,
    );
    if (matches.length !== 1 || matches[0]?.status !== test.status)
      throw new Error(`前置用例缺失或结果改变：${test.file} > ${test.name}`);
  }
  return { commit: previous.commit, preserved: expected.length };
};
