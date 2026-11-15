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
import { fileURLToPath } from 'node:url';

export const SOURCE = fileURLToPath(new URL('../../', import.meta.url));

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
          throw new Error(`工作根已占用：${root}（PID ${owner}）`);
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
    if (!owned) throw new Error(`工作根已占用：${root}`);
  } catch (error) {
    if (!stableRoot) await rm(root, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(candidate, { recursive: true, force: true });
  }
  const close = async () => {
    if (stableRoot) {
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
    } else await rm(root, { recursive: true, force: true });
  };
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
