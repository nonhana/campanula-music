import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { execa } from 'execa';

import { ROOT } from '../suites.ts';

const { values } = parseArgs({ options: { sha: { type: 'string' } } });
if (!values.sha) throw new Error('需要完整 --sha');
await mkdir(join(ROOT, '.reports/candidates'), { recursive: true });
const root = await mkdtemp(join(ROOT, '.reports/candidates/run-'));
console.log(`交付候选与报告：${root}`);
const commands = [
  [
    'build:delivery',
    '--sha',
    values.sha,
    '--adapter',
    'node',
    '--out',
    join(root, 'node'),
    '--version',
    `${values.sha}-a`,
  ],
  [
    'test:delivery',
    '--sha',
    values.sha,
    '--adapter',
    'node',
    '--candidate',
    join(root, 'node'),
  ],
  [
    'build:delivery',
    '--sha',
    values.sha,
    '--adapter',
    'vercel',
    '--out',
    join(root, 'vercel'),
    '--version',
    `${values.sha}-a`,
  ],
  [
    'test:delivery',
    '--sha',
    values.sha,
    '--adapter',
    'vercel',
    '--candidate',
    join(root, 'vercel'),
  ],
  [
    'build:delivery',
    '--sha',
    values.sha,
    '--adapter',
    'node',
    '--out',
    join(root, 'next'),
    '--version',
    `${values.sha}-b`,
  ],
  [
    'test:delivery',
    '--sha',
    values.sha,
    '--adapter',
    'node',
    '--candidate',
    join(root, 'next'),
  ],
  [
    'test:pwa',
    '--sha',
    values.sha,
    '--candidate',
    join(root, 'node'),
    '--next',
    join(root, 'next'),
  ],
];
const results: { command: string[]; exitCode: number }[] = [];
try {
  for (const command of commands) {
    const child = await execa('pnpm', command, {
      cwd: ROOT,
      env: { CAMPANULA_DELIVERY_RUN: root },
      stdio: 'inherit',
      reject: false,
    });
    results.push({ command, exitCode: child.exitCode ?? 1 });
    if (child.exitCode !== 0)
      throw new Error(`交付失败：pnpm ${command.join(' ')}`);
  }
  const pwa = JSON.parse(await readFile(join(root, 'pwa.json'), 'utf8'));
  if (pwa.status !== 'passed' || pwa.sha !== values.sha)
    throw new Error('缺少同 SHA 的生产 PWA 结果');
  await writeFile(
    join(root, 'verification.json'),
    JSON.stringify(
      { sha: values.sha, status: 'passed', results, pwa },
      null,
      2,
    ),
  );
  await execa('tar', [
    '-czf',
    `${root}.tar.gz`,
    '-C',
    root,
    'node',
    'vercel',
    'next',
    'verification.json',
    'pwa.json',
  ]);
} catch (error) {
  await writeFile(
    join(root, 'verification.json'),
    JSON.stringify(
      { sha: values.sha, status: 'failed', results, error: String(error) },
      null,
      2,
    ),
  );
  throw error;
}
await writeFile(
  join(ROOT, '.reports/latest-candidate.json'),
  JSON.stringify({ sha: values.sha, root, archive: `${root}.tar.gz` }),
);
