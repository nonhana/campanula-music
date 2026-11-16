import { join } from 'node:path';
import process from 'node:process';

import pWaitFor from 'p-wait-for';

import { startCommand } from '../_kit/command.ts';

export const startProduction = async (candidate: string) => {
  const command = startCommand(
    process.execPath,
    [join(candidate, 'output/index.js')],
    {
      cwd: candidate,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '0',
        COOKIE_SECRET: 'a'.repeat(64),
        SHUTDOWN_TIMEOUT: '1',
      },
    },
  );
  try {
    await pWaitFor(
      () => {
        if (command.child.exitCode !== null)
          throw new Error(`Node 入口退出：${command.logs}`);
        return /Listening on http:\/\/127\.0\.0\.1:\d+/.test(command.logs);
      },
      { interval: 20, timeout: 15_000 },
    );
    const baseURL = command.logs.match(
      /Listening on (http:\/\/127\.0\.0\.1:\d+)/,
    )![1];
    if (!(await fetch(baseURL)).ok)
      throw new Error(`Node 外壳不可用：${baseURL}`);
    return { ...command, baseURL };
  } catch (error) {
    await command.close();
    throw error;
  }
};
