import { execFile } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import type { JSONReport } from '@playwright/test/reporter';
import { expect, it } from 'vitest';

import {
  browserCases,
  verifyReleaseBrowserInventory,
} from '../ci/browser-inventory.ts';
import { ROOT } from '../suites.ts';

const sha = 'a'.repeat(40);
const shards = ['desktop', 'phone'].flatMap((project) =>
  ['journeys', 'accessibility'].map((suite) => ({
    name: `browser-${project}-${suite}`,
    sha,
    cases: [
      {
        id: `${project}-${suite}`,
        project,
        file: `${suite}/demo.spec.ts`,
        name: 'demo',
        status: 'expected',
      },
    ],
  })),
);
const listed = shards.flatMap((shard) => shard.cases);

it('发布门禁要求四个视口和目录组合与独立枚举的用例逐项一致', () => {
  expect(verifyReleaseBrowserInventory(listed, shards, sha)).toEqual(listed);
  expect(() =>
    verifyReleaseBrowserInventory(
      [...listed, { ...listed[0], id: 'new' }],
      shards,
      sha,
    ),
  ).toThrow();
  expect(() =>
    verifyReleaseBrowserInventory(listed, shards.slice(1), sha),
  ).toThrow();
  for (const changed of [
    { ...shards[0], sha: 'b'.repeat(40) },
    { ...shards[0], cases: [...shards[0].cases, ...shards[0].cases] },
    { ...shards[0], cases: shards[1].cases },
    { ...shards[0], cases: [{ ...listed[0], status: 'skipped' }] },
  ])
    expect(() =>
      verifyReleaseBrowserInventory(listed, [changed, ...shards.slice(1)], sha),
    ).toThrow();
});

it('playwright 合并两种视口的清单后，手机分片仍能逐项匹配', async () => {
  const list = async (args: string[]) => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        fileURLToPath(import.meta.resolve('@playwright/test/cli')),
        'test',
        '--config',
        'tests/browser/playwright.config.ts',
        '--list',
        '--reporter=json',
        ...args,
      ],
      { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 },
    );
    const report: JSONReport = JSON.parse(stdout);
    return browserCases(report.suites);
  };
  const [all, phone] = await Promise.all([
    list([]),
    list(['journeys/', '--project', 'phone']),
  ]);
  expect(phone.length).toBeGreaterThan(0);
  expect(phone.map((test) => test.id).sort()).toEqual(
    all
      .filter(
        (test) => test.project === 'phone' && test.file.startsWith('journeys/'),
      )
      .map((test) => test.id)
      .sort(),
  );
});
