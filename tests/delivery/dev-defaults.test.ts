import type { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';

import { expect, it } from 'vitest';

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
          join(SOURCE, 'scripts/dev.mts'),
          ...(mode === 'mock' ? ['--mock'] : []),
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
