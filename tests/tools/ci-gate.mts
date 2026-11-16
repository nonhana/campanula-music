import { execFileSync } from 'node:child_process';
import process from 'node:process';

import { releaseBrowserJobs } from '../ci/browser-inventory.ts';
import { requireSuccessfulJobs } from '../delivery/release.ts';
import type { ReleaseJob } from '../delivery/release.ts';
import { REQUIRED_JOBS } from '../suites.ts';

const needs = JSON.parse(process.env.CAMPANULA_CI_NEEDS ?? '{}') as Record<
  string,
  { result: string }
>;
const verify = process.argv[2] === 'verify';
const required = verify
  ? ['static', 'coverage', 'browser']
  : REQUIRED_JOBS.filter((name) => name !== 'acceptance');
for (const name of required)
  if (needs[name]?.result !== 'success')
    throw new Error(`CI 门禁拒绝：${name}=${needs[name]?.result ?? 'missing'}`);
const endpoint = `repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/attempts/${process.env.GITHUB_RUN_ATTEMPT}/jobs?per_page=100`;
const pages = JSON.parse(
  execFileSync('gh', ['api', '--paginate', '--slurp', endpoint], {
    encoding: 'utf8',
  }),
) as { jobs: ReleaseJob[] }[];
const jobs = pages
  .flatMap((page) => page.jobs)
  .map((job) => ({ ...job, name: job.name.split(' / ').at(-1)! }));
requireSuccessfulJobs(
  verify ? ['static', 'coverage', ...releaseBrowserJobs] : required,
  jobs,
);
console.log(`同一候选必要检查全部成功：${Object.keys(needs).join(', ')}`);
