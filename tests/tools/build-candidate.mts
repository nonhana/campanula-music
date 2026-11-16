import { createHash } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { execa } from 'execa';

import { createWorkspace } from '../_kit/workspace.ts';
import { sealCandidate } from '../delivery/candidate.ts';
import { ROOT } from '../suites.ts';

const { values } = parseArgs({
  options: {
    sha: { type: 'string' },
    adapter: { type: 'string' },
    out: { type: 'string' },
    version: { type: 'string' },
  },
});
const { stdout: sha } = await execa('git', ['rev-parse', 'HEAD'], {
  cwd: ROOT,
});
if (
  values.sha !== sha ||
  !['node', 'vercel'].includes(values.adapter ?? '') ||
  !values.out
)
  throw new Error(
    '必须指定当前完整 --sha、--adapter node|vercel、未使用的 --out',
  );
const adapter = values.adapter as 'node' | 'vercel';
const candidate = resolve(values.out);
const version = values.version ?? sha;
await mkdir(dirname(candidate), { recursive: true });
await mkdir(candidate);
const workspace = await createWorkspace();
const { stdout: tracked } = await execa('git', ['ls-files', '-z'], {
  cwd: ROOT,
});
const sourceHash = async () => {
  const hash = createHash('sha256');
  for (const file of tracked.split('\0').filter(Boolean).sort()) {
    const path = join(ROOT, file);
    hash
      .update(file)
      .update(
        (await lstat(path)).isSymbolicLink()
          ? await readlink(path)
          : await readFile(path),
      );
  }
  return hash.digest('hex');
};
let passed = false;
try {
  const before = await sourceHash();
  await cp(
    join(ROOT, 'vite.config.mts'),
    join(workspace.root, 'vite.config.mts'),
  );
  const result = await execa(
    process.execPath,
    [join(ROOT, 'node_modules/vite/bin/vite.js'), 'build'],
    {
      cwd: workspace.root,
      extendEnv: false,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'production',
        VERCEL: adapter === 'vercel' ? '1' : '',
        CAMPANULA_BUILD_VERSION: version,
      },
      reject: false,
    },
  );
  await writeFile(
    join(candidate, 'build.log'),
    `${result.stdout}\n${result.stderr}`,
  );
  if (result.exitCode !== 0)
    throw new Error(
      `构建 ${adapter} 失败：${candidate}/build.log\n${result.stderr}`,
    );
  if (before !== (await sourceHash())) throw new Error('构建期间源码改变');
  await cp(
    join(workspace.root, adapter === 'node' ? 'build' : '.vercel/output'),
    join(candidate, 'output'),
    { recursive: true, verbatimSymlinks: true },
  );
  const { stdout: dirty } = await execa('git', ['status', '--porcelain'], {
    cwd: ROOT,
  });
  await sealCandidate({
    candidate,
    sha,
    adapter,
    version,
    source: { digest: before, dirty: !!dirty },
  });
  passed = true;
} finally {
  await workspace.close();
  await writeFile(
    join(candidate, 'build-result.json'),
    JSON.stringify({
      sha,
      adapter,
      version,
      passed,
      workspace: workspace.root,
      cleaned: true,
    }),
  );
}
console.log(`候选构建：${candidate}`);
