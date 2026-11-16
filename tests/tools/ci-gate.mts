import process from 'node:process';

import { REQUIRED_JOBS } from '../suites.ts';

const needs = JSON.parse(process.env.CAMPANULA_CI_NEEDS ?? '{}') as Record<
  string,
  { result: string }
>;
for (const name of REQUIRED_JOBS.filter((name) => name !== 'ci'))
  if (needs[name]?.result !== 'success')
    throw new Error(`CI 门禁拒绝：${name}=${needs[name]?.result ?? 'missing'}`);
console.log(`同一候选必要检查全部成功：${Object.keys(needs).join(', ')}`);
