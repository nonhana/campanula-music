import type { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { expect, it } from 'vitest';

import { startCommand } from '../_kit/command.ts';
import { createWorkspace, SOURCE } from '../_kit/workspace.ts';

it.each(['product', 'mock'])(
  '%s 默认 HTTPS 未准备证书时退出并指明准备命令，不退回 HTTP',
  async (mode) => {
    const workspace = await createWorkspace();
    try {
      const child = spawn(
        process.execPath,
        [
          '--import',
          import.meta.resolve('tsx'),
          join(SOURCE, `tests/tools/dev-${mode}.mts`),
        ],
        {
          cwd: workspace.root,
          env: {
            PATH: process.env.PATH,
            TSX_DISABLE_CACHE: '1',
            CAMPANULA_DEV_TLS_DIR: join(workspace.root, 'missing-tls'),
            CAMPANULA_DEV_MOCK_ROOT: join(workspace.root, 'mock'),
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
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
      expect(code, logs).toBe(1);
      expect(logs).toContain('pnpm dev:setup');
      expect(logs).not.toContain('Local:   http://');
    } finally {
      await workspace.close();
    }
  },
  30_000,
);

it('代理遇到绑定端口权限错误时给出三个开发终端统一改用高位端口的指令并清理缓存', async () => {
  const root = await mkdtemp(join(tmpdir(), 'campanula-proxy-denied-'));
  const bin = join(root, 'bin');
  const tls = join(root, 'tls');
  await mkdir(bin);
  await mkdir(tls);
  // 只重放已观察到的 CLI 绑定失败；证书解析和 TLS 连接由真实 HTTPS 专项检查。
  await writeFile(
    join(bin, 'caddy'),
    "#!/bin/sh\nprintf '%s\\n' 'listen tcp 127.0.0.1:443: bind: permission denied' >&2\nexit 1\n",
    { mode: 0o755 },
  );
  for (const file of ['ca.crt', 'site.crt', 'site.key'])
    await writeFile(join(tls, file), 'unused in permission failure replay');
  const command = startCommand(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      join(SOURCE, 'tests/tools/dev-proxy.mts'),
    ],
    {
      cwd: root,
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        TSX_DISABLE_CACHE: '1',
        CAMPANULA_DEV_TLS_DIR: tls,
        CAMPANULA_DEV_PROXY_ROOT: join(root, 'proxy'),
        CAMPANULA_HTTPS_PORT: '443',
      },
    },
  );
  try {
    await command.finished;
    expect(command.child.exitCode, command.logs).toBe(1);
    expect(command.logs).toContain('CAMPANULA_HTTPS_PORT=8443');
    for (const entry of ['pnpm dev:proxy', 'pnpm dev', 'pnpm dev:mock'])
      expect(command.logs).toContain(entry);
    expect(await readdir(join(root, 'proxy'))).toEqual([]);
  } finally {
    await command.close();
    await rm(root, { recursive: true, force: true });
  }
});
