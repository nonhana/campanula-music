import type { JSONReportSuite } from '@playwright/test/reporter';

import baseline from '../baselines/browser-100.json' with { type: 'json' };
import { requireInventory } from './plan.ts';

interface BrowserCase {
  id: string;
  file: string;
  name: string;
  project: string;
  status: string;
}

// A combined Playwright JSON report retains only the first project's spec.id.
export const browserCases = (
  suites: JSONReportSuite[],
  parents: string[] = [],
): BrowserCase[] =>
  suites.flatMap((suite) => {
    const titles = [...parents, suite.title];
    return [
      ...suite.specs.flatMap((spec) =>
        spec.tests.map((test) => ({
          id: JSON.stringify([
            test.projectName,
            spec.file,
            ...titles,
            spec.title,
          ]),
          file: spec.file,
          name: spec.title,
          project: test.projectName,
          status: test.status,
        })),
      ),
      ...browserCases(suite.suites ?? [], titles),
    ];
  });

export const missingBrowserBaseline = (
  cases: BrowserCase[],
  expected = baseline.cases,
) =>
  expected.find((item) => {
    const matches = cases.filter(
      (test) =>
        test.file === item.file &&
        test.name === item.name &&
        test.project === item.project,
    );
    return matches.length !== 1 || matches[0].status !== 'expected';
  });

export const releaseBrowserJobs = ['desktop', 'phone'].flatMap((project) =>
  ['journeys', 'accessibility'].map((suite) => `browser-${project}-${suite}`),
);

export const verifyReleaseBrowserInventory = (
  listed: BrowserCase[],
  shards: { name: string; sha: string; cases: BrowserCase[] }[],
  sha: string,
) => {
  requireInventory(
    releaseBrowserJobs,
    shards.map((s) => s.name),
  );
  for (const shard of shards) {
    if (shard.sha !== sha || !shard.cases.length)
      throw new Error(`${shard.name} 缺少同一 SHA 的用例`);
    for (const test of shard.cases) {
      if (
        test.status !== 'expected' ||
        `browser-${test.project}-${test.file.split('/')[0]}` !== shard.name
      )
        throw new Error(
          `${shard.name} 用例状态或归属错误：${test.file} / ${test.name}`,
        );
    }
  }
  const actual = shards.flatMap((s) => s.cases);
  requireInventory(
    listed.map((t) => t.id),
    actual.map((t) => t.id),
  );
  return actual;
};
