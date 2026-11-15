import type { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

import { expect, it } from 'vitest';

import { SOURCE } from '../_kit/workspace.ts';

it('两个自动化命令并发完成，各自保留测试和覆盖率报告', async () => {
  const run = async () => {
    const child = spawn(
      process.execPath,
      [
        '--import',
        import.meta.resolve('tsx'),
        join(SOURCE, 'tests/tools/run.mts'),
        'behavior',
        'tests/behavior/session.test.ts',
        '-t',
        '未登录：没有当前账号',
        '--coverage',
      ],
      {
        cwd: SOURCE,
        env: {
          PATH: process.env.PATH,
          TSX_DISABLE_CACHE: '1',
          CAMPANULA_COVERAGE_CALIBRATE: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let log = '';
    child.stdout.on('data', (chunk: Buffer) => {
      log += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      log += chunk.toString();
    });
    const timeout = setTimeout(() => child.kill('SIGKILL'), 60_000);
    try {
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
      expect(code, log).toBe(0);
      const root = /本次测试报告：([^\n]+)/.exec(log)?.[1];
      expect(root, log).toBeDefined();
      const manifest = JSON.parse(
        await readFile(join(root!, 'run.json'), 'utf8'),
      ) as { status: string; reportDir: string; coverageDir: string };
      expect(manifest.status).toBe('passed');
      const result = JSON.parse(
        await readFile(join(manifest.reportDir, 'tests.json'), 'utf8'),
      );
      expect(result.numPassedTests).toBe(1);
      expect(
        JSON.parse(
          await readFile(
            join(manifest.coverageDir, 'calibration.json'),
            'utf8',
          ),
        ),
      ).toEqual({ accountGetExecuted: true, unusedRouteUntouched: true });
      return root;
    } finally {
      clearTimeout(timeout);
    }
  };
  const results = await Promise.allSettled([run(), run()]);
  for (const result of results)
    if (result.status === 'rejected') throw result.reason;
  expect(
    new Set(
      results.map((result) => result.status === 'fulfilled' && result.value),
    ).size,
  ).toBe(2);
}, 90_000);
