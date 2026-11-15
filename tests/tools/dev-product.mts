import { spawn } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { SOURCE } from '../_kit/workspace.ts';
import {
  developmentSettings,
  requireDevelopmentProxy,
} from './https/development.mts';

try {
  const args = process.argv.slice(2);
  const settings = args.includes('--http')
    ? undefined
    : developmentSettings('product');
  if (settings) await requireDevelopmentProxy(settings);
  const env = { ...process.env };
  delete env.CAMPANULA_DEV_ORIGIN;
  if (settings) env.CAMPANULA_DEV_ORIGIN = settings.origin;
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL('./bin/vite.js', import.meta.resolve('vite/package.json')),
      ),
      'dev',
      '--config',
      join(SOURCE, 'vite.config.mts'),
      '--configLoader',
      'native',
      ...args.filter((arg) => arg !== '--http'),
    ],
    {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    },
  );
  console.log(`root=${process.cwd()} pid=${child.pid}`);
  process.once('SIGINT', () => child.kill('SIGINT'));
  process.once('SIGTERM', () => child.kill('SIGTERM'));
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 1));
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
