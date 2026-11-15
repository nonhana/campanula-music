import { resolve } from 'node:path';
import process from 'node:process';

import { startEnvironment } from '../_kit/environment.ts';
import { SOURCE } from '../_kit/workspace.ts';
import {
  developmentSettings,
  requireDevelopmentProxy,
} from './https/development.mts';

try {
  const portAt = process.argv.indexOf('--port');
  const port = portAt < 0 ? 5174 : Number(process.argv[portAt + 1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('--port 需要 1–65535');
  const origin = process.argv.includes('--http')
    ? undefined
    : developmentSettings('mock').origin;
  if (origin) await requireDevelopmentProxy(developmentSettings('mock'));
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());
  const environment = await startEnvironment({
    mode: 'mock',
    root: resolve(
      SOURCE,
      process.env.CAMPANULA_DEV_MOCK_ROOT ?? '.campanula/mock',
    ),
    port,
    ...(origin ? { origin } : {}),
    signal: controller.signal,
  });
  console.log(
    `Mock ready: ${environment.baseURL}/mock/login\nroot=${environment.root} pid=${environment.pid}`,
  );

  await environment.finished;
  if (!controller.signal.aborted && environment.exitCode !== 0)
    throw new Error(`mock 子进程失败：${environment.logs}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
