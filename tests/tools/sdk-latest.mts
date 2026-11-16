import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ROOT } from '../suites.ts';

await mkdir(join(ROOT, '.reports/registry'), { recursive: true });
const report = await mkdtemp(join(ROOT, '.reports/registry/run-'));
const locked = JSON.parse(
  await readFile(
    join(ROOT, 'node_modules/hana-music-api/package.json'),
    'utf8',
  ),
).version;
let result: unknown;
try {
  const response = await fetch(
    'https://registry.npmjs.org/hana-music-api/latest',
    { signal: AbortSignal.timeout(20_000) },
  );
  if (!response.ok) throw new Error(`registry HTTP ${response.status}`);
  const latest = (await response.json()) as { name: string; version: string };
  if (latest.name !== 'hana-music-api' || !latest.version)
    throw new Error('registry 返回无效包');
  result = {
    status: 'passed',
    locked,
    latest: latest.version,
    updateAvailable: locked !== latest.version,
    candidateCommand: 'pnpm test:sdk --candidate /已安装依赖的候选包',
    scope: '仅联网查询，不代表候选合同或锁定离线回归通过',
  };
} catch (error) {
  result = {
    status: 'failed',
    locked,
    error: String(error),
    scope: '联网查询失败，锁定离线回归独立',
  };
  throw error;
} finally {
  await writeFile(join(report, 'result.json'), JSON.stringify(result, null, 2));
  console.log(`registry 查询报告：${report}`);
}
