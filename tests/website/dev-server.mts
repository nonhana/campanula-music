import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { execaNode } from 'execa';

const source = fileURLToPath(new URL('../../', import.meta.url));
// Astro 按源码和依赖的共同目录解析样式虚拟模块，工作根须留在同一检出目录内。
const root = await mkdtemp(join(source, '.reports/website/dev-'));
const cancellation = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => cancellation.abort());
const record = (closed: boolean) =>
  writeFile(
    join(process.env.CAMPANULA_WEBSITE_REPORT!, 'dev-environment.json'),
    JSON.stringify({ root, pid: process.pid, port: 4388, closed }),
  );
try {
  await record(false);
  for (const path of [
    'package.json',
    'uno.config.mts',
    'uno.palette.mts',
    'src',
    'website',
  ]) {
    cancellation.signal.throwIfAborted();
    await cp(join(source, path), join(root, path), {
      recursive: true,
      filter: (path) =>
        !/\/(?:node_modules|\.astro|\.kit|dist)(?:\/|$)/.test(path),
    });
  }
  cancellation.signal.throwIfAborted();
  await mkdir(join(root, 'node_modules'));
  for (const name of await readdir(join(source, 'node_modules')))
    if (!name.startsWith('.'))
      await symlink(
        join(source, 'node_modules', name),
        join(root, 'node_modules', name),
        'dir',
      );
  const child = execaNode(new URL('./dev-worker.mts', import.meta.url), {
    ipcInput: root,
    cancelSignal: cancellation.signal,
    gracefulCancel: true,
    forceKillAfterDelay: 3000,
    killDescendants: true,
    reject: false,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const result = await child;
  if (result.failed && !result.isCanceled) process.exitCode = 1;
} catch (error) {
  if (!cancellation.signal.aborted) throw error;
} finally {
  await rm(root, { recursive: true, force: true });
  await record(true);
}
