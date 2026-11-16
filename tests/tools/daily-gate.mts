import { appendFileSync, globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import type { Lane } from '../ci/plan.ts';
import { requireInventory } from '../ci/plan.ts';
import { discoverTests, sourceSha } from '../suites.ts';
import type { ContrastReport } from './browser/contrast-report.ts';
import { summarizeContrast } from './browser/contrast-report.ts';

if (
  process.env.PLAN_RESULT !== 'success' ||
  process.env.LANES_RESULT !== 'success'
)
  throw new Error('计划或必要分片失败、取消或跳过');
const sha = sourceSha();
const plan = JSON.parse(process.env.DAILY_MATRIX!).include as Lane[];
const dir = process.argv[2];
const receipts = globSync('*.json', { cwd: dir }).map((file) =>
  JSON.parse(readFileSync(join(dir, file), 'utf8')),
) as {
  sha: string;
  name: string;
  files: string[];
  cases: number;
  contrast: ContrastReport[];
}[];
const suites = discoverTests();
requireInventory(
  [...suites.unit, ...suites.behavior, ...suites.contract],
  plan
    .filter((lane) => lane.name.startsWith('product-'))
    .flatMap((lane) => lane.files),
);
for (const required of ['static', 'browser-desktop', 'browser-phone'])
  if (!plan.some((lane) => lane.name === required))
    throw new Error(`缺少日常任务：${required}`);
requireInventory(
  plan.map((l) => l.name),
  receipts.map((r) => r.name),
);
for (const lane of plan) {
  const receipt = receipts.find((r) => r.name === lane.name)!;
  if (receipt.sha !== sha || (lane.files.length && !(receipt.cases > 0)))
    throw new Error(`缺少同一 SHA 的用例：${lane.name}`);
  requireInventory(lane.files, receipt.files);
}
if (plan.some((l) => l.name.startsWith('contrast-')))
  summarizeContrast(
    receipts.flatMap((r) => r.contrast),
    true,
  );
const summary = receipts
  .map((r) => `- ${r.name} · 通过${r.cases ? ` · ${r.cases} 条用例` : ''}`)
  .join('\n');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `提交 \`${sha}\`\n\n${summary}\n`,
  );
