import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CookieJar } from 'tough-cookie';
import { expect, it } from 'vitest';

import { startEnvironment } from '../_kit/environment.ts';
import { requestURL } from '../_kit/http.ts';

it('临时 mock 通过真实 HTTP 登录，关闭后端口与工作根消失', async () => {
  const environment = await startEnvironment({ mode: 'mock' });
  try {
    const response = await fetch(`${environment.baseURL}/mock/login`, {
      redirect: 'manual',
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('Secure');
  } finally {
    await environment.close();
  }
  await expect(access(environment.root)).rejects.toThrow();
  await expect(fetch(environment.baseURL)).rejects.toThrow();
  await environment.close();
}, 60_000);

it('稳定根拒绝重复启动，关闭后重启沿用密钥，reset 保留会话', async () => {
  const root = await mkdtemp(join(tmpdir(), 'campanula-stable-'));
  let environment = await startEnvironment({ mode: 'mock', root });
  try {
    await expect(startEnvironment({ mode: 'mock', root })).rejects.toThrow(
      '工作根已占用',
    );
    const response = await fetch(`${environment.baseURL}/mock/login`, {
      redirect: 'manual',
    });
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    const account = () =>
      fetch(`${environment.baseURL}/api/account`, { headers: { cookie } }).then(
        (value) => value.json(),
      );
    expect(await account()).toMatchObject({ account: { id: 10000001 } });
    await environment.reset();
    expect(await account()).toMatchObject({ account: { id: 10000001 } });
    await environment.close();
    await writeFile(join(root, '.owner'), String(environment.pid));
    environment = await startEnvironment({ mode: 'mock', root });
    expect(await account()).toMatchObject({ account: { id: 10000001 } });
    expect(
      await fetch(`${environment.baseURL}/api/account`).then((value) =>
        value.json(),
      ),
    ).toEqual({ account: null });
  } finally {
    await environment.close();
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);

it.each(['product-first', 'mock-first'])(
  '%s：同一 Cookie jar 的会话和普通生成文件不被 mock 覆盖',
  async (order) => {
    const productRoot = await mkdtemp(join(tmpdir(), 'campanula-product-'));
    const first = await startEnvironment({
      ...(order === 'product-first' ? { root: productRoot } : {}),
      mode: order === 'product-first' ? 'product' : 'mock',
    });
    const second = await startEnvironment({
      ...(order === 'mock-first' ? { root: productRoot } : {}),
      mode: order === 'product-first' ? 'mock' : 'product',
    });
    const product = order === 'product-first' ? first : second;
    const mock = order === 'mock-first' ? first : second;
    try {
      const jar = new CookieJar();
      await jar.setCookie(product.sessionCookie, product.baseURL);
      const baseline = await readFile(
        join(product.root, 'node_modules/$app/tsconfig.json'),
        'utf8',
      );
      await writeFile(
        join(product.root, 'node_modules/.cache-sentinel'),
        'ordinary-cache',
      );
      const env = await readFile(
        join(product.root, '.svelte-kit/generated/dev/env/config.js'),
        'utf8',
      );
      const request = async (
        environment: typeof product,
        path: string,
        init: RequestInit = {},
      ) => {
        const response = await fetch(environment.baseURL + path, {
          ...init,
          redirect: 'manual',
          headers: {
            ...init.headers,
            cookie: await jar.getCookieString(environment.baseURL),
          },
        });
        for (const cookie of response.headers.getSetCookie())
          await jar.setCookie(cookie, environment.baseURL);
        return response;
      };
      expect((await request(product, '/api/account')).status).toBe(428);
      expect((await request(mock, '/mock/login')).status).toBe(303);
      expect(
        await request(mock, '/api/account').then((r) => r.json()),
      ).toMatchObject({ account: { id: 10000001 } });
      expect(
        (
          await request(mock, '/api/playlists/900000019/name', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: order }),
          })
        ).status,
      ).toBe(200);
      expect(
        await request(mock, '/api/playlists/900000019', {
          headers: {
            'x-campanula-check-tokens': JSON.stringify({
              requests: ['detail'],
            }),
          },
        }).then((r) => r.json()),
      ).toMatchObject({ playlist: { name: order } });
      await mock.reset();
      expect(
        await request(mock, '/api/account').then((r) => r.json()),
      ).toMatchObject({ account: { id: 10000001 } });
      expect(
        (await request(mock, '/api/logout', { method: 'POST' })).status,
      ).toBe(200);
      expect(await request(mock, '/api/account').then((r) => r.json())).toEqual(
        { account: null },
      );
      expect((await request(product, '/api/account')).status).toBe(428);
      expect(
        await readFile(
          join(product.root, 'node_modules/$app/tsconfig.json'),
          'utf8',
        ),
      ).toBe(baseline);
      expect(
        await readFile(
          join(product.root, '.svelte-kit/generated/dev/env/config.js'),
          'utf8',
        ),
      ).toBe(env);
      for (const path of [
        '/mock/login',
        '/api/mock/status',
        '/mock-assets/audio/1.wav',
      ])
        expect((await request(product, path)).status).toBe(404);
      const wrongHost = await requestURL(
        `${product.baseURL}/api/login/qr/key`,
        { headers: { host: new URL(mock.baseURL).host } },
      );
      expect(wrongHost.status).toBe(421);
      expect(wrongHost.headers.has('set-cookie')).toBe(false);
      expect(await wrongHost.text()).toContain(product.baseURL);
      expect(
        await readFile(
          join(product.root, 'node_modules/.cache-sentinel'),
          'utf8',
        ),
      ).toBe('ordinary-cache');
      await product.close();
      const restarted = await startEnvironment({
        mode: 'product',
        root: productRoot,
      });
      try {
        expect((await request(restarted, '/api/account')).status).toBe(428);
      } finally {
        await restarted.close();
      }
    } finally {
      await second.close();
      await first.close();
      await rm(productRoot, { recursive: true, force: true });
    }
  },
  60_000,
);

it('两个临时 mock 并发改名，失败、reset 和关闭只影响自己的实例', async () => {
  const stableRoot = await mkdtemp(join(tmpdir(), 'campanula-manual-'));
  const product = await startEnvironment({ mode: 'product' });
  const stable = await startEnvironment({ mode: 'mock', root: stableRoot });
  const left = await startEnvironment({ mode: 'mock' });
  const right = await startEnvironment({ mode: 'mock' });
  const login = async (environment: typeof left) => {
    const response = await fetch(`${environment.baseURL}/mock/login`, {
      redirect: 'manual',
    });
    return response.headers.get('set-cookie')!.split(';')[0];
  };
  try {
    const all = [product, stable, left, right];
    expect(new Set(all.map((e) => e.pid)).size).toBe(4);
    expect(
      new Set(
        await Promise.all(
          all.map((e) => readFile(join(e.root, '.env'), 'utf8')),
        ),
      ).size,
    ).toBe(4);
    for (const e of all) {
      expect((await lstat(join(e.root, 'node_modules'))).isSymbolicLink()).toBe(
        false,
      );
      expect(
        await readFile(join(e.root, 'node_modules/$app/tsconfig.json'), 'utf8'),
      ).toContain('.svelte-kit/types');
    }
    expect(
      await fetch(`${product.baseURL}/api/account`).then((r) => r.json()),
    ).toEqual({ account: null });
    const [a, b] = await Promise.all([login(left), login(right)]);
    const name = async (
      environment: typeof left,
      cookie: string,
      value?: string,
    ) => {
      const response = await fetch(
        `${environment.baseURL}/api/playlists/900000019${value ? '/name' : ''}`,
        {
          method: value ? 'POST' : 'GET',
          headers: {
            cookie,
            'content-type': 'application/json',
            'x-campanula-check-tokens': JSON.stringify({
              requests: ['detail'],
            }),
          },
          ...(value ? { body: JSON.stringify({ name: value }) } : {}),
        },
      );
      expect(response.status).toBe(200);
      return response.json();
    };
    await Promise.all([name(left, a, '左边'), name(right, b, '右边')]);
    expect(await name(left, a)).toMatchObject({ playlist: { name: '左边' } });
    expect(await name(right, b)).toMatchObject({ playlist: { name: '右边' } });
    await left.reset();
    expect(await name(left, a)).toMatchObject({ playlist: { name: 'poems' } });
    expect(await name(right, b)).toMatchObject({ playlist: { name: '右边' } });
    const failedRoot = await mkdtemp(join(tmpdir(), 'campanula-failure-'));
    try {
      await expect(
        startEnvironment({
          mode: 'mock',
          root: failedRoot,
          port: Number(new URL(left.baseURL).port),
        }),
      ).rejects.toThrow('环境启动失败');
      await expect(access(join(failedRoot, '.owner'))).rejects.toThrow();
      const retry = await startEnvironment({ mode: 'mock', root: failedRoot });
      await retry.close();
    } finally {
      await rm(failedRoot, { recursive: true, force: true });
    }
    await left.close();
    expect(await name(right, b)).toMatchObject({ playlist: { name: '右边' } });
    expect(
      await fetch(`${right.baseURL}/api/account`, {
        headers: { cookie: a },
      }).then((r) => r.json()),
    ).toEqual({ account: null });
  } finally {
    await left.close();
    await right.close();
    await stable.close();
    await product.close();
    await rm(stableRoot, { recursive: true, force: true });
  }
}, 60_000);

it.each([0, 150])(
  '启动 %i ms 取消释放稳定锁并可重试',
  async (after) => {
    const root = await mkdtemp(join(tmpdir(), 'campanula-abort-'));
    const controller = new AbortController();
    const starting = startEnvironment({
      mode: 'mock',
      root,
      signal: controller.signal,
    });
    const abort = after
      ? setTimeout(() => controller.abort(), after)
      : undefined;
    if (!after) controller.abort();
    try {
      await expect(starting).rejects.toThrow('环境启动失败');
      await expect(access(join(root, '.owner'))).rejects.toThrow();
      const retry = await startEnvironment({ mode: 'mock', root });
      await retry.close();
    } finally {
      clearTimeout(abort);
      await rm(root, { recursive: true, force: true });
    }
  },
  60_000,
);

it('运行中的子进程失败后删除临时根，另一实例仍可用', async () => {
  const failed = await startEnvironment({ mode: 'mock' });
  const alive = await startEnvironment({ mode: 'mock' });
  try {
    process.kill(failed.pid, 'SIGKILL');
    await failed.finished;
    await expect(access(failed.root)).rejects.toThrow();
    await expect(fetch(failed.baseURL)).rejects.toThrow();
    expect((await fetch(`${alive.baseURL}/api/mock/status`)).status).toBe(200);
  } finally {
    await failed.close();
    await alive.close();
  }
}, 60_000);

it('拒绝把可写 node_modules 指向别处，保留外部生成类型', async () => {
  const root = await mkdtemp(join(tmpdir(), 'campanula-link-'));
  const outside = await mkdtemp(join(tmpdir(), 'campanula-outside-'));
  await mkdir(join(outside, '$app'), { recursive: true });
  const original = '{"outside":true}';
  await writeFile(join(outside, '$app/tsconfig.json'), original);
  await symlink(outside, join(root, 'node_modules'), 'dir');
  let environment: Awaited<ReturnType<typeof startEnvironment>> | undefined;
  try {
    await expect(
      (async () => {
        environment = await startEnvironment({ mode: 'mock', root });
      })(),
    ).rejects.toThrow('可写路径不能是软链');
    expect(await readFile(join(outside, '$app/tsconfig.json'), 'utf8')).toBe(
      original,
    );
  } finally {
    await environment?.close();
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
}, 60_000);

it('两个启动器同时回收死拥有者，只能有一方占用稳定工作根', async () => {
  const root = await mkdtemp(join(tmpdir(), 'campanula-race-'));
  const previous = await startEnvironment({ mode: 'mock', root });
  await previous.close();
  await mkdir(join(root, '.owner'));
  await writeFile(
    join(root, '.owner', `${previous.pid}-stale-token`),
    String(previous.pid),
  );
  const results = await Promise.allSettled([
    startEnvironment({ mode: 'mock', root }),
    startEnvironment({ mode: 'mock', root }),
  ]);
  try {
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    for (const result of results) {
      if (result.status === 'fulfilled')
        expect(
          (await fetch(`${result.value.baseURL}/api/mock/status`)).status,
        ).toBe(200);
    }
  } finally {
    for (const result of results)
      if (result.status === 'fulfilled') await result.value.close();
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
