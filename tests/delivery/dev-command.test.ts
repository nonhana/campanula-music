import type { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import process from 'node:process';

import { expect, it } from 'vitest';

import { createWorkspace, SOURCE } from '../_kit/workspace.ts';

it('普通 dev:http 的实际入口遇到已占用端口时退出，不启动另一个端口', async () => {
  const workspace = await createWorkspace();
  const occupied = createServer();
  await new Promise<void>((resolve) =>
    occupied.listen(0, 'localhost', resolve),
  );
  const port = (occupied.address() as { port: number }).port;
  const child = spawn(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      join(SOURCE, 'scripts/dev.mts'),
      '--http',
      '--host',
      'localhost',
      '--port',
      String(port),
    ],
    {
      cwd: workspace.root,
      env: {
        PATH: process.env.PATH,
        ...workspace.env,
        CAMPANULA_DEV_ORIGIN: 'https://local.campanula.test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let logs = '';
  child.stdout.on('data', (chunk: Buffer) => {
    logs += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    logs += chunk.toString();
  });
  const timeout = setTimeout(() => child.kill('SIGTERM'), 15_000);
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    expect(code, logs).toBe(1);
    expect(logs).toContain(`Port ${port} is already in use`);
  } finally {
    clearTimeout(timeout);
    child.kill('SIGTERM');
    await new Promise<void>((resolve) => occupied.close(() => resolve()));
    await workspace.close();
  }
}, 30_000);
