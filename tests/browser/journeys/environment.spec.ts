import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { startEnvironment } from '../../_kit/environment.ts';
import { createWorkspace, SOURCE } from '../../_kit/workspace.ts';
import { controlNetwork, expect, login, test } from '../fixture.ts';

test('两个实例、空设备和 reset 的 Cookie、IndexedDB、Cache Storage 隔离', async ({
  page,
  browser,
  environment,
  localOrigins,
}, info) => {
  await login(page, '/playlists/900000019');
  const originalCookies = await page.context().cookies();
  await page.evaluate(async () => {
    localStorage.setItem('isolation', 'listener-a');
    const cache = await caches.open('listener-a');
    await cache.put('/isolation', new Response('saved-a'));
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('listener-a', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('data');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
    });
  });
  const other = await startEnvironment({ mode: 'product' });
  localOrigins.add(other.baseURL);
  const isolated = await browser.newContext();
  const external = await controlNetwork(
    isolated,
    new Set([environment.baseURL]),
  );
  try {
    const sameDevice = await page.context().newPage();
    await sameDevice.goto(`${other.baseURL}/robots.txt`);
    await expect(sameDevice.locator('body')).toContainText('User-agent');
    expect(
      await sameDevice.evaluate(async () => ({
        local: localStorage.getItem('isolation'),
        databases: (await indexedDB.databases()).map((d) => d.name),
        caches: await caches.keys(),
      })),
    ).toMatchObject({ local: null, caches: [] });
    expect(
      (await sameDevice.context().cookies(other.baseURL)).some((c) =>
        originalCookies.some((o) => o.value === c.value),
      ),
    ).toBe(false);
    await sameDevice.close();
    const fresh = await isolated.newPage();
    await fresh.goto(environment.baseURL);
    await expect(
      fresh.getByRole('heading', { name: '用网易云账号登录' }),
    ).toBeVisible();
    expect(
      await fresh.evaluate(async () => ({
        local: localStorage.getItem('isolation'),
        database: (await indexedDB.databases()).some(
          (d) => d.name === 'listener-a',
        ),
        caches: await caches.keys(),
      })),
    ).toEqual({ local: null, database: false, caches: [] });
    await environment.reset();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'poems', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(async () => ({
        local: localStorage.getItem('isolation'),
        database: (await indexedDB.databases()).some(
          (d) => d.name === 'listener-a',
        ),
        cached: await (
          await caches.open('listener-a')
        )
          .match('/isolation')
          .then((r) => r?.text()),
      })),
    ).toEqual({ local: 'listener-a', database: true, cached: 'saved-a' });
  } finally {
    try {
      await isolated.close();
    } finally {
      await other.close();
    }
    expect(external).toEqual([]);
    await info.attach('second-instance', {
      body: JSON.stringify({
        root: other.root,
        pid: other.pid,
        baseURL: other.baseURL,
        removed: await access(other.root).then(
          () => false,
          () => true,
        ),
      }),
      contentType: 'application/json',
    });
  }
});

test('独立源码上的组件 HMR 和新增路由，不改人工源文件', async ({
  browser,
}, info) => {
  const source = await mkdtemp(join(tmpdir(), 'campanula-browser-source-'));
  const original = await readFile(
    join(SOURCE, 'src/lib/components/boot/Brand.svelte'),
    'utf8',
  );
  let environment: Awaited<ReturnType<typeof startEnvironment>> | undefined;
  const context = await browser.newContext();
  const origins = new Set<string>();
  const external = await controlNetwork(context, origins);
  try {
    await cp(join(SOURCE, 'src'), join(source, 'src'), { recursive: true });
    await cp(join(SOURCE, 'static'), join(source, 'static'), {
      recursive: true,
    });
    const workspace = await createWorkspace({ root: source });
    await workspace.close();
    environment = await startEnvironment({ mode: 'mock', source });
    origins.add(environment.baseURL);
    const page = await context.newPage();
    await page.goto(`${environment.baseURL}/mock/login`);
    await expect(page.locator('[data-brand-name]').first()).toHaveText(
      'Campanula',
    );
    await page.evaluate(() =>
      Object.assign(window, { hmrMarker: 'same-document' }),
    );
    await writeFile(
      join(source, 'src/lib/components/boot/Brand.svelte'),
      original.replace('>Campanula<', '>Campanula HMR<'),
    );
    await expect(page.locator('[data-brand-name]').first()).toHaveText(
      'Campanula HMR',
    );
    expect(
      await page.evaluate(
        () => (window as Window & { hmrMarker?: string }).hmrMarker,
      ),
    ).toBe('same-document');
    await mkdir(join(source, 'src/routes/browser-new-route'));
    await writeFile(
      join(source, 'src/routes/browser-new-route/+page.svelte'),
      '<h1>新增路由已生效</h1>',
    );
    const routeURL = `${environment.baseURL}/browser-new-route`;
    await expect
      .poll(async () => (await page.request.get(routeURL)).status())
      .toBe(200);
    // 路由重建的 HMR 刷新可能中止同时发出的导航，仍须等真实页面显示新路由。
    await expect
      .poll(async () => {
        try {
          await page.goto(routeURL);
        } catch (error) {
          if (
            error instanceof Error &&
            (error.message.includes('net::ERR_ABORTED') ||
              error.message.includes(
                `is interrupted by another navigation to "${routeURL}"`,
              ))
          )
            return false;
          throw error;
        }
        return true;
      })
      .toBe(true);
    await expect(
      page.getByRole('heading', { name: '新增路由已生效' }),
    ).toBeVisible();
    expect(
      await readFile(
        join(SOURCE, 'src/lib/components/boot/Brand.svelte'),
        'utf8',
      ),
    ).toBe(original);
    await page.screenshot({ path: info.outputPath('hmr-route.png') });
  } finally {
    try {
      await context.close();
    } finally {
      try {
        await environment?.close();
      } finally {
        await rm(source, { recursive: true, force: true });
      }
    }
    expect(external).toEqual([]);
  }
});

test('人工端口被占用时，独立服务仍用自己的高位端口', async ({
  browser,
}, info) => {
  const listeners = [];
  const occupied = [];
  const context = await browser.newContext();
  const origins = new Set<string>();
  const external = await controlNetwork(context, origins);
  let environment: Awaited<ReturnType<typeof startEnvironment>> | undefined;
  try {
    for (const port of [5173, 5174]) {
      const server = createServer((_, response) =>
        response.end('owned-port-sentinel'),
      );
      listeners.push(server);
      occupied.push(
        await new Promise((resolve) => {
          server.once('error', (error) => {
            expect((error as NodeJS.ErrnoException).code).toBe('EADDRINUSE');
            resolve({ port, owner: 'existing' });
          });
          server.listen(port, '127.0.0.1', () =>
            resolve({ port, owner: 'test' }),
          );
        }),
      );
    }
    environment = await startEnvironment({ mode: 'mock' });
    origins.add(environment.baseURL);
    expect([5173, 5174]).not.toContain(
      Number(new URL(environment.baseURL).port),
    );
    const page = await context.newPage();
    await page.goto(`${environment.baseURL}/mock/login`);
    await expect(page.locator('main')).toBeVisible();
    await info.attach('occupied-ports', {
      body: JSON.stringify({ occupied, baseURL: environment.baseURL }),
      contentType: 'application/json',
    });
  } finally {
    try {
      await context.close();
    } finally {
      try {
        await environment?.close();
      } finally {
        await Promise.all(
          listeners.map(
            (server) =>
              new Promise<void>((resolve, reject) =>
                server.listening
                  ? server.close((error) => (error ? reject(error) : resolve()))
                  : resolve(),
              ),
          ),
        );
      }
    }
    expect(external).toEqual([]);
  }
});

test('失败重试从空设备与原始歌单开始', async ({ page }, info) => {
  expect(await page.context().cookies()).toEqual([]);
  await login(page, '/playlists/900000019');
  expect(
    await page.evaluate(() => localStorage.getItem('retry-marker')),
  ).toBeNull();
  await expect(
    page.getByRole('heading', { name: 'poems', exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem('retry-marker', 'previous-attempt'),
  );
  await page.getByRole('button', { name: '歌单操作：poems' }).click();
  await page.getByRole('menuitem', { name: '编辑歌单信息' }).click();
  await page
    .getByRole('textbox', { name: '歌单名称' })
    .fill('前一次尝试的名字');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '前一次尝试的名字', exact: true }),
  ).toBeVisible();
  if (process.env.CAMPANULA_VERIFY_RETRY === '1' && info.retry === 0)
    throw new Error('受控失败：下一次必须从空设备与原始歌单开始');
});
