import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

import { execa } from 'execa';

import { discoverTests, ROOT, VALIDATION_PLAN } from '../suites.ts';

const name = process.argv[2];
if (!(name in VALIDATION_PLAN) || name === 'default')
  throw new Error('选择 verify、https、sdk 或 delivery');
const plan = VALIDATION_PLAN[name as keyof typeof VALIDATION_PLAN];
const sha = (await execa('git', ['rev-parse', 'HEAD'], { cwd: ROOT })).stdout;
await mkdir(join(ROOT, '.reports/plans'), { recursive: true });
const report = await mkdtemp(join(ROOT, '.reports/plans/run-'));
const results: { command: string; exitCode: number }[] = [];
const versions = await Promise.all(
  ['hana-music-api', 'vitest', '@playwright/test', '@axe-core/playwright'].map(
    async (pkg) => [
      pkg,
      JSON.parse(
        await readFile(join(ROOT, 'node_modules', pkg, 'package.json'), 'utf8'),
      ).version,
    ],
  ),
);
try {
  for (const template of plan) {
    const command = template.replace('<SHA>', sha);
    const [program, ...args] = command.split(' ');
    const result = await execa(program, args, {
      cwd: ROOT,
      stdio: 'inherit',
      reject: false,
    });
    results.push({ command, exitCode: result.exitCode ?? 1 });
    if (result.exitCode !== 0) throw new Error(`失败命令：${command}`);
  }
} finally {
  await writeFile(
    join(report, 'result.json'),
    JSON.stringify(
      {
        sha,
        name,
        plan,
        selected: discoverTests(),
        versions: Object.fromEntries(versions),
        results,
        status:
          results.length === plan.length &&
          results.every((step) => step.exitCode === 0)
            ? 'passed'
            : 'failed',
      },
      null,
      2,
    ),
  );
  console.log(`同份验证清单报告：${report}`);
}
