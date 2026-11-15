import type { Buffer } from 'node:buffer';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createWorkspace, SOURCE } from './workspace.ts';

export interface EnvironmentOptions {
  mode: 'product' | 'mock';
  root?: string;
  source?: string;
  port?: number;
  origin?: string;
  env?: Record<string, string>;
  signal?: AbortSignal;
  request?: (url: string, init?: RequestInit) => Promise<Response>;
}

export const startEnvironment = async (options: EnvironmentOptions) => {
  const workspace = await createWorkspace(options);
  let logs = '';
  let baseURL = '';
  let internalURL = '';
  let stage = 'starting';
  const child = fork(
    fileURLToPath(new URL('../tools/environment-worker.mts', import.meta.url)),
    [],
    {
      cwd: workspace.root,
      execArgv: ['--import', fileURLToPath(import.meta.resolve('tsx'))],
      env: {
        PATH: process.env.PATH,
        TSX_DISABLE_CACHE: '1',
        CAMPANULA_SSR_COVERAGE_DIR: process.env.CAMPANULA_SSR_COVERAGE_DIR,
        ...workspace.env,
        CAMPANULA_DEV_HOST: options.mode === 'mock' ? '127.0.0.1' : 'localhost',
        ...(options.origin ? { CAMPANULA_DEV_ORIGIN: options.origin } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    },
  );
  child.stdout?.on('data', (data: Buffer) => {
    logs += data.toString();
  });
  child.stderr?.on('data', (data: Buffer) => {
    logs += data.toString();
  });
  const exited = new Promise<void>((resolve) =>
    child.once('close', () => resolve()),
  );
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      options.signal?.removeEventListener('abort', abort);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
        const force = setTimeout(() => child.kill('SIGKILL'), 5000);
        await exited;
        clearTimeout(force);
      }
      await workspace.close();
      const dir = join(SOURCE, '.reports/environments');
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, `${randomUUID()}.json`),
        JSON.stringify(
          {
            mode: options.mode,
            root: workspace.root,
            baseURL,
            internalURL,
            pid: child.pid,
            stage,
            exit: child.exitCode ?? child.signalCode,
            cleaned: true,
            temporary: !options.root,
            logs,
          },
          null,
          2,
        ),
      );
    })());
  const finished = exited.then(() => {
    if (stage === 'ready' && child.exitCode !== 0)
      stage = 'failed while running';
    return close();
  });
  const abort = () => {
    void close();
  };
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    const ready = await new Promise<{ baseURL: string; sessionCookie: string }>(
      (resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('启动超时')), 45_000);
        const finish = (
          error?: Error,
          address?: { baseURL: string; sessionCookie: string },
        ) => {
          clearTimeout(timeout);
          if (error) reject(error);
          else resolve(address!);
        };
        child.once('error', (error) => finish(error));
        child.once('exit', (code, signal) =>
          finish(new Error(`启动进程退出：${code ?? signal}`)),
        );
        child.on(
          'message',
          (message: {
            baseURL?: string;
            sessionCookie?: string;
            error?: string;
          }) => {
            if (message.error) finish(new Error(message.error));
            if (message.baseURL)
              finish(undefined, {
                baseURL: message.baseURL,
                sessionCookie: message.sessionCookie!,
              });
          },
        );
        if (options.signal?.aborted) {
          finish(new Error('启动已取消'));
          return;
        }
        child.send({
          mode: options.mode,
          port: options.port ?? 0,
          root: workspace.root,
        });
      },
    );
    internalURL = ready.baseURL;
    baseURL = options.origin ?? internalURL;
    const { sessionCookie } = ready;
    stage = 'ready';
    return {
      baseURL,
      internalURL,
      sessionCookie,
      finished,
      get exitCode() {
        return child.exitCode;
      },
      root: workspace.root,
      pid: child.pid!,
      get logs() {
        return logs;
      },
      reset: async () => {
        if (options.mode !== 'mock') throw new Error('普通环境没有模拟上游');
        const response = await (options.request ?? fetch)(
          `${baseURL}/api/mock/reset`,
          {
            method: 'POST',
          },
        );
        if (!response.ok) throw new Error(`reset 失败：${response.status}`);
      },
      close,
    };
  } catch (cause) {
    stage = `failed: ${String(cause)}`;
    await close();
    throw new Error(
      `环境启动失败：root=${workspace.root} pid=${child.pid} exit=${child.exitCode ?? child.signalCode}\n${logs}`,
      { cause },
    );
  }
};
