import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { sveltekit } from '@sveltejs/kit/vite';
import { createServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CheckTokens } from '#lib/api/check-token.js';
import {
  CHECK_TOKENS_HEADER,
  RENEWAL_ATTEMPTED_HEADER,
  RENEWAL_REQUIRED_HEADER,
} from '#lib/api/check-token.js';

import { mockPlugin } from '../src/lib/server/mock/vite-plugin.ts';
import { TEST_OUT_DIR } from './harness/world';

let origin = '';
let closed: () => Promise<void>;
let cookie = '';

beforeAll(async () => {
  process.env.COOKIE_SECRET = 'campanula-mock-test-secret-0123456789abcdef';
  process.env.LOGIN_COOKIE_NAME = 'campanula_login_mock';
  const vite = await createServer({
    configFile: false,
    logLevel: 'silent',
    server: {
      middlewareMode: true,
      hmr: false,
      ws: false,
      watch: null,
    },
    plugins: [mockPlugin(), sveltekit({ outDir: TEST_OUT_DIR })],
  });
  const http = createHttpServer((req, res) => vite.middlewares(req, res));
  await new Promise<void>((resolve) => http.listen(0, 'localhost', resolve));
  origin = `http://localhost:${(http.address() as AddressInfo).port}`;
  closed = async () => {
    http.closeAllConnections();
    await new Promise((resolve) => http.close(resolve));
    await vite.close();
  };
}, 30_000);

afterAll(async () => {
  await closed?.();
});

const api = async (
  path: string,
  init: RequestInit = {},
  tokens?: CheckTokens,
): Promise<Response> => {
  const headers = new Headers(init.headers);
  headers.set('cookie', cookie);
  if (tokens) headers.set(CHECK_TOKENS_HEADER, JSON.stringify(tokens));
  return fetch(`${origin}${path}`, {
    ...init,
    headers,
  });
};

describe('mock 开发服务器', () => {
  it('自动登录、账号、歌单、红心、播放地址都能用', async () => {
    const login = await fetch(`${origin}/mock/login`, { redirect: 'manual' });
    expect(login.status).toBe(303);
    const setCookie = login.headers.get('set-cookie') ?? '';
    cookie = setCookie.split(';')[0]!;
    expect(cookie.startsWith('campanula_login_mock=')).toBe(true);

    const account = await api('/api/account', {
      headers: { [RENEWAL_ATTEMPTED_HEADER]: '1' },
    });
    expect(
      ((await account.json()) as { account: { id: number } }).account.id,
    ).toBe(10000001);

    const list = await api('/api/playlists?uid=10000001');
    const playlists = ((await list.json()) as { playlists: { id: number }[] })
      .playlists;
    expect(playlists).toHaveLength(55);

    const hearts = await api('/api/hearts?uid=10000001');
    expect(
      ((await hearts.json()) as { songIds: number[] }).songIds,
    ).toHaveLength(4984);

    const url = await api('/api/songs/3433267939/play-url?quality=exhigh');
    expect(((await url.json()) as { url: string }).url).toBe(
      '/mock-assets/audio/3433267939.wav',
    );
  }, 30_000);

  it('写操作刷新后还在，reset 回种子', async () => {
    const renamed = await api('/api/playlists/900000019/name', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'HTTP 改过的名字' }),
    });
    expect(renamed.status).toBe(200);
    expect((await api('/api/playlists/900000019')).status).toBe(400);
    const shown = await api(
      '/api/playlists/900000019',
      {},
      {
        requests: ['mock-detail-first'],
      },
    );
    expect(shown.status).toBe(200);
    expect(
      ((await shown.json()) as { playlist: { name: string } }).playlist.name,
    ).toBe('HTTP 改过的名字');

    await fetch(`${origin}/api/mock/reset`, { method: 'POST' });
    const back = await api(
      '/api/playlists/900000019',
      {},
      {
        requests: ['mock-reset-first'],
      },
    );
    expect(back.status).toBe(200);
    expect(
      ((await back.json()) as { playlist: { name: string } }).playlist.name,
    ).toBe('poems');
  }, 30_000);

  it('不认识的场景回 400，不会把 mock 弄坏', async () => {
    const bad = await fetch(`${origin}/api/mock/scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'bogus' }),
    });
    expect(bad.status).toBe(400);
    const prototype = await fetch(`${origin}/api/mock/scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'toString' }),
    });
    expect(prototype.status).toBe(400);
    expect((await api('/api/account')).status).toBe(200);
  }, 30_000);

  it('场景和覆盖报告', async () => {
    const scenario = await fetch(`${origin}/api/mock/scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'login-expired' }),
    });
    expect(scenario.status).toBe(200);
    const account = await api('/api/account');
    expect(account.status).toBe(428);
    expect(account.headers.get(RENEWAL_REQUIRED_HEADER)).toBe('expired');
    expect(account.headers.get('cache-control')).toBe('no-store');
    expect(await account.json()).toEqual({ renewalRequired: 'expired' });
    const probe = await api('/api/account', {
      headers: { [RENEWAL_ATTEMPTED_HEADER]: '1' },
    });
    expect(probe.status).toBe(401);
    expect(await probe.json()).toEqual({ error: { kind: 'needsLogin' } });
    expect((await api('/api/login/refresh', { method: 'POST' })).status).toBe(
      400,
    );
    const refreshed = await api(
      '/api/login/refresh',
      { method: 'POST' },
      { requests: ['mock-expired-renewal'] },
    );
    expect(refreshed.status).toBe(401);

    const report = await api('/api/mock/coverage');
    expect(((await report.json()) as { scenario: string }).scenario).toBe(
      'login-expired',
    );
    await fetch(`${origin}/api/mock/reset`, { method: 'POST' });
  }, 30_000);
});
