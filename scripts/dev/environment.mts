import type { Buffer } from 'node:buffer';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  rmdir,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { execaNode } from 'execa';

export const SOURCE = fileURLToPath(new URL('../../', import.meta.url));

const claimRoot = async (root: string) => {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const lock = join(root, '.owner');
  const token = `${process.pid}-${randomUUID()}`;
  const candidate = await mkdtemp(join(root, '.claim-'));
  let owned = false;
  try {
    await writeFile(join(candidate, token), String(process.pid));
    for (let attempt = 0; attempt < 3 && !owned; attempt++) {
      try {
        await rename(candidate, lock);
        owned = true;
      } catch (error) {
        if (
          !['EEXIST', 'ENOTEMPTY', 'ENOTDIR'].includes(
            (error as NodeJS.ErrnoException).code ?? '',
          )
        )
          throw error;
        let staleToken: string | undefined;
        let owner: number;
        try {
          const stat = await lstat(lock);
          if (stat.isSymbolicLink())
            throw new Error(`工作根锁不能是软链：${lock}`);
          if (stat.isDirectory()) {
            const entries = await readdir(lock);
            if (entries.length > 1) throw new Error(`工作根锁损坏：${lock}`);
            staleToken = entries[0];
            if (!staleToken) continue;
            owner = Number(staleToken.split('-')[0]);
          } else {
            owner = Number(await readFile(lock, 'utf8'));
          }
          if (!Number.isInteger(owner) || owner <= 0)
            throw new Error(`无效的拥有者：${lock}`);
          try {
            process.kill(owner, 0);
          } catch (cause) {
            if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause;
            try {
              await unlink(staleToken ? join(lock, staleToken) : lock);
              if (staleToken) await rmdir(lock);
            } catch (changed) {
              if (
                !['ENOENT', 'ENOTEMPTY', 'EEXIST', 'EISDIR', 'EPERM'].includes(
                  (changed as NodeJS.ErrnoException).code ?? '',
                )
              )
                throw changed;
            }
            continue;
          }
          throw Object.assign(
            new Error(`工作根已占用：${root}（PID ${owner}）`),
            { code: 'ELOCKED' },
          );
        } catch (changed) {
          if (
            !['ENOENT', 'EISDIR', 'ENOTDIR'].includes(
              (changed as NodeJS.ErrnoException).code ?? '',
            )
          )
            throw changed;
        }
      }
    }
    if (!owned)
      throw Object.assign(new Error(`工作根已占用：${root}`), {
        code: 'ELOCKED',
      });
  } finally {
    await rm(candidate, { recursive: true, force: true });
  }
  return async () => {
    try {
      await unlink(join(lock, token));
      await rmdir(lock);
    } catch (error) {
      if (
        !['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(
          (error as NodeJS.ErrnoException).code ?? '',
        )
      )
        throw error;
    }
  };
};

export const ownRoot = async (
  root: string,
  { signal, wait = 0 }: { signal?: AbortSignal; wait?: number } = {},
) => {
  const deadline = Date.now() + wait;
  while (true) {
    signal?.throwIfAborted();
    try {
      return await claimRoot(root);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== 'ELOCKED' ||
        Date.now() >= deadline
      )
        throw error;
      await delay(100, undefined, { signal });
    }
  }
};

export const createWorkspace = async ({
  root: stableRoot,
  source = SOURCE,
  env = {},
}: {
  root?: string;
  source?: string;
  env?: Record<string, string>;
} = {}) => {
  if (stableRoot && resolve(stableRoot) === resolve(SOURCE))
    throw new Error('测试工作根不能使用产品根');
  for (const key of Object.keys(env))
    if (
      !['COOKIE_SECRET', 'LOGIN_COOKIE_NAME', 'NETEASE_REAL_IP'].includes(key)
    )
      throw new Error(`环境不接受配置：${key}`);
  source = await realpath(source);
  let root = stableRoot ?? (await mkdtemp(join(tmpdir(), 'campanula-')));
  await mkdir(root, { recursive: true });
  root = await realpath(root);
  if (root === (await realpath(SOURCE)))
    throw new Error('测试工作根不能使用产品根');
  const release = await ownRoot(root);
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      await release();
      if (!stableRoot) await rm(root, { recursive: true, force: true });
    })());
  try {
    for (const path of [
      '.env',
      'identity.json',
      'package.json',
      'tsconfig.json',
      'node_modules',
      'node_modules/$app',
      'node_modules/.vite',
      'node_modules/.vite-vitest',
      '.svelte-kit',
    ]) {
      try {
        if ((await lstat(join(root, path))).isSymbolicLink())
          throw new Error(`工作根可写路径不能是软链：${join(root, path)}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    const link = async (target: string, path: string) => {
      await mkdir(dirname(path), { recursive: true });
      try {
        await symlink(target, path, 'dir');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (
          (await lstat(path)).isSymbolicLink() &&
          resolve(dirname(path), await readlink(path)) !== resolve(target)
        ) {
          await rm(path);
          await symlink(target, path, 'dir');
        }
      }
    };
    const pkg = JSON.parse(
      await readFile(join(SOURCE, 'package.json'), 'utf8'),
    ) as {
      devDependencies: Record<string, string>;
    };
    await mkdir(join(root, 'node_modules'), { recursive: true });
    await mkdir(join(root, 'node_modules/$app/tsconfig'), { recursive: true });
    await writeFile(
      join(root, 'node_modules/$app/tsconfig/service-worker.json'),
      '{}',
    );
    try {
      await writeFile(join(root, 'node_modules/$app/tsconfig.json'), '{}', {
        flag: 'wx',
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    for (const name of Object.keys(pkg.devDependencies))
      await link(
        await realpath(join(SOURCE, 'node_modules', name)),
        join(root, 'node_modules', name),
      );
    for (const name of ['src', 'static'])
      await link(join(source, name), join(root, name));
    for (const name of ['uno.config.mts', 'uno.palette.mts'])
      await link(join(SOURCE, name), join(root, name));
    for (const name of ['package.json', 'tsconfig.json'])
      await writeFile(join(root, name), await readFile(join(SOURCE, name)));
    const envFile = join(root, '.env');
    let values: Record<string, string>;
    try {
      values = JSON.parse(
        await readFile(join(root, 'identity.json'), 'utf8'),
      ) as Record<string, string>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      values = {
        COOKIE_SECRET: randomBytes(32).toString('hex'),
        LOGIN_COOKIE_NAME: 'campanula_login',
        NETEASE_REAL_IP: '',
      };
      await writeFile(join(root, 'identity.json'), JSON.stringify(values), {
        mode: 0o600,
      });
    }
    values = { ...values, ...env };
    await writeFile(
      envFile,
      Object.entries(values)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join('\n'),
      { mode: 0o600 },
    );
    return { root, env: values, close };
  } catch (error) {
    await close();
    throw error;
  }
};

export interface ProcessEnvironmentOptions {
  mode: 'product' | 'mock';
  root?: string;
  source?: string;
  port?: number;
  origin?: string;
  env?: Record<string, string>;
  signal?: AbortSignal;
  workerFile: string;
  httpHost: string;
  inheritEnv?: boolean;
  ownerRoot?: string;
  syntheticSession?: boolean;
  tls?: { cert: string; key: string; ca: string };
  onLog?: (message: string) => void;
  request?: (url: string, init?: RequestInit) => Promise<Response>;
}

export const launchEnvironment = async (options: ProcessEnvironmentOptions) => {
  const workspace = options.ownerRoot
    ? {
        root: await realpath(options.root ?? SOURCE),
        env: {},
        close: await ownRoot(options.ownerRoot),
      }
    : await createWorkspace(options);
  let logs = '';
  let baseURL = '';
  let internalURL = '';
  let stage = 'starting';
  const cancellation = new AbortController();
  const child = execaNode(options.workerFile, ['--worker'], {
    cwd: workspace.root,
    nodeOptions: ['--import', fileURLToPath(import.meta.resolve('tsx'))],
    extendEnv: !!options.inheritEnv,
    env: {
      PATH: process.env.PATH,
      TSX_DISABLE_CACHE: '1',
      CAMPANULA_SSR_COVERAGE_DIR: process.env.CAMPANULA_SSR_COVERAGE_DIR,
      ...workspace.env,
      CAMPANULA_DEV_HOST: options.httpHost,
      CAMPANULA_DEV_ORIGIN: options.origin,
    },
    stdin: 'ignore',
    all: true,
    buffer: false,
    reject: false,
    cancelSignal: cancellation.signal,
    gracefulCancel: true,
    killDescendants: true,
    ipcInput: {
      mode: options.mode,
      port: options.port ?? 0,
      root: workspace.root,
      tls: options.tls,
      syntheticSession: options.syntheticSession,
    },
  });
  child.all.on('data', (data: Buffer) => {
    logs += data.toString();
    options.onLog?.(data.toString());
  });
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      options.signal?.removeEventListener('abort', abort);
      cancellation.abort();
      await child;
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
            exit:
              child.nodeChildProcess.exitCode ??
              child.nodeChildProcess.signalCode,
            cleaned: true,
            temporary: !options.root,
            logs,
          },
          null,
          2,
        ),
      );
    })());
  const finished = child.then(() => {
    if (stage === 'ready' && child.nodeChildProcess.exitCode !== 0)
      stage = 'failed while running';
    return close();
  });
  const abort = () => {
    void close();
  };
  options.signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(
    () => cancellation.abort(new Error('启动超时')),
    45_000,
  );
  try {
    options.signal?.throwIfAborted();
    const ready = (await child.getOneMessage()) as {
      baseURL?: string;
      sessionCookie?: string;
      error?: string;
    };
    if (ready.error) throw new Error(ready.error);
    if (!ready.baseURL) throw new Error('开发服务器未返回就绪地址');
    internalURL = ready.baseURL;
    baseURL = options.origin ?? internalURL;
    const sessionCookie = ready.sessionCookie ?? '';
    stage = 'ready';
    return {
      baseURL,
      internalURL,
      sessionCookie,
      finished,
      get exitCode() {
        return child.nodeChildProcess.exitCode;
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
      `环境启动失败：root=${workspace.root} pid=${child.pid} exit=${child.nodeChildProcess.exitCode ?? child.nodeChildProcess.signalCode}\n${logs}`,
      { cause },
    );
  } finally {
    clearTimeout(timeout);
  }
};
