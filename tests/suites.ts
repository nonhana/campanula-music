import { execFileSync } from 'node:child_process';
import { existsSync, globSync } from 'node:fs';
import { matchesGlob, relative } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import previous from './baselines/issue-99.json' with { type: 'json' };
import latest from './baselines/issue-100.json' with { type: 'json' };
import baseline from './baselines/migration.json' with { type: 'json' };

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const SUITES = {
  unit: ['tests/unit/**/*.test.ts'],
  behavior: ['tests/behavior/**/*.test.ts'],
  contract: ['tests/contract/**/*.test.ts'],
  delivery: ['tests/delivery/**/*.test.ts'],
  browser: ['tests/browser/journeys/**/*.spec.ts'],
  a11y: ['tests/browser/accessibility/**/*.spec.ts'],
  pwa: ['tests/delivery/pwa/*.spec.ts'],
};
export const selectTests = (
  files: string[],
  suites: Record<string, string[]> = SUITES,
  required = [
    ...baseline.migrations.map(({ to }) => to),
    ...previous.cases.map(({ file }) => file),
    ...latest.cases.map(({ file }) => file),
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
    'tests/delivery/pwa/offline.spec.ts',
    'tests/delivery/pwa/update.spec.ts',
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

export const comparePrevious = (report: TestReport, files?: string[]) => {
  const expected = [
    ...baseline.migrations.flatMap(({ to, cases }) =>
      cases.map((test) => ({ file: to, ...test })),
    ),
    ...previous.cases,
  ].filter((test) => !files || files.includes(test.file));
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

export const REQUIRED_JOBS = [
  'verify',
  'https',
  'delivery',
  'sdk',
  'acceptance',
];

const staticChecks = [
  'pnpm lint',
  'pnpm fmt:check',
  'pnpm check',
  'pnpm check:endpoints',
  'pnpm fixtures:index:check',
];
export const VALIDATION_PLAN = {
  static: staticChecks,
  coverage: [
    'pnpm exec tsx tests/tools/run.mts all --coverage --vitest-only',
    'pnpm test:coverage:calibrate',
  ],
  environment: [
    'pnpm test:environment',
    'pnpm test:environment:https',
    'pnpm test:browser tests/browser/journeys/environment.spec.ts',
  ],
  diagnostics: [
    'pnpm test:browser tests/browser/journeys/diagnostics.spec.ts',
    'pnpm test:browser:faults',
  ],
  default: ['pnpm test --coverage'],
  verify: [
    ...staticChecks,
    'pnpm sdk:report',
    'pnpm test --coverage',
    'pnpm test:coverage:calibrate',
  ],
  https: ['pnpm test:environment:https'],
  sdk: ['pnpm test:sdk'],
  delivery: ['pnpm delivery:verify --sha <SHA>'],
  registry: ['pnpm sdk:latest'],
} as const;

export const compareIssue100 = (report: TestReport, files?: string[]) => {
  const selected = latest.cases.filter(
    (test) => !files || files.includes(test.file),
  );
  for (const expected of selected) {
    const matches = report.testResults
      .filter((file) => relative(ROOT, file.name) === expected.file)
      .flatMap((file) =>
        file.assertionResults.filter((test) => test.fullName === expected.name),
      );
    if (matches.length !== 1 || matches[0].status !== expected.status)
      throw new Error(
        `前置 #100 用例缺失或改变：${expected.file} > ${expected.name}`,
      );
  }
  return { commit: latest.commit, preserved: selected.length };
};

export const sourceSha = () => {
  const supplied = process.env.CAMPANULA_TEST_SHA;
  const sha = existsSync(`${ROOT}.git`)
    ? execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim()
    : supplied;
  if (!sha || !/^[a-f\d]{40}$/.test(sha) || (supplied && supplied !== sha))
    throw new Error('隔离测试副本必须接收宿主的完整 SHA，不能与 checkout 冲突');
  return sha;
};

export const assertRunResult = (report: TestReport, complete: boolean) => {
  const tests = report.testResults.flatMap((file) => file.assertionResults);
  if (
    !tests.some((test) => test.status === 'passed' || test.status === 'failed')
  )
    throw new Error('所选范围没有执行任何用例：检查文件路径和用例全名过滤条件');
  const rejected = tests.find(
    (test) =>
      test.status === 'failed' || (complete && test.status !== 'passed'),
  );
  if (rejected)
    throw new Error(`用例未通过：${rejected.fullName} (${rejected.status})`);
};
