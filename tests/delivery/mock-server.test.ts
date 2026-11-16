import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CheckTokens } from '#lib/api/check-token.ts';
import {
  CHECK_TOKENS_HEADER,
  RENEWAL_ATTEMPTED_HEADER,
  RENEWAL_REQUIRED_HEADER,
} from '#lib/api/check-token.ts';
import { PLAYLIST_TRACKS_STEP_HEADER } from '#lib/api/library.ts';

import { startEnvironment } from '../_kit/environment.ts';

let origin = '';
let closed: () => Promise<void>;
let cookie = '';

beforeAll(async () => {
  const environment = await startEnvironment({
    mode: 'mock',
    env: { LOGIN_COOKIE_NAME: 'campanula_login_mock' },
  });
  origin = environment.baseURL;
  closed = environment.close;
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
    expect(playlists).toHaveLength(3);

    const hearts = await api('/api/hearts?uid=10000001');
    expect(
      ((await hearts.json()) as { songIds: number[] }).songIds,
    ).toHaveLength(2);

    const url = await api('/api/songs/3433267939/play-url?quality=exhigh');
    expect(((await url.json()) as { url: string }).url).toBe(
      '/mock-assets/audio/3433267939.wav',
    );
  }, 30_000);

  it('下载地址对应本地生成音频，忽略 Range 时返回完整文件供重下', async () => {
    const response = await api(
      '/api/songs/3433267939/download-url?quality=exhigh',
    );
    expect(response.status).toBe(200);
    const download = (await response.json()) as {
      downloadable: boolean;
      url: string;
      size: number;
    };
    expect(download.downloadable).toBe(true);
    const audio = await api(download.url);
    expect(audio.status).toBe(200);
    expect(audio.headers.get('content-type')).toContain('audio/wav');
    const bytes = new Uint8Array(await audio.arrayBuffer());
    expect(bytes.length).toBe(download.size);
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('RIFF');
    const range = await api(download.url, {
      headers: { range: 'bytes=0-43,44-87' },
    });
    expect(range.status).toBe(200);
    expect(new Uint8Array(await range.arrayBuffer())).toEqual(bytes);
    for (const [request, expected, start, end] of [
      ['bytes=0-43', 206, 0, 43],
      ['bytes=44-', 206, 44, bytes.length - 1],
      ['bytes=-4', 206, bytes.length - 4, bytes.length - 1],
      ['bytes=999999-', 416, 0, -1],
      ['bytes=44-43', 416, 0, -1],
      ['bytes=-0', 416, 0, -1],
    ] as const) {
      const part = await api(download.url, { headers: { range: request } });
      expect(part.status).toBe(expected);
      expect(part.headers.get('content-range')).toBe(
        expected === 416
          ? `bytes */${bytes.length}`
          : `bytes ${start}-${end}/${bytes.length}`,
      );
      expect(new Uint8Array(await part.arrayBuffer())).toEqual(
        bytes.slice(start, end + 1),
      );
    }
    for (const method of ['HEAD', 'POST']) {
      const head = await api(download.url, {
        method,
        headers: { range: 'bytes=0-43' },
      });
      expect(head.status).toBe(200);
      expect(head.headers.get('content-length')).toBe(String(bytes.length));
      expect(head.headers.get('content-range')).toBeNull();
      expect(new Uint8Array(await head.arrayBuffer())).toEqual(
        method === 'HEAD' ? new Uint8Array() : bytes,
      );
    }
  });

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

  it('曲目分步请求只需一枚令牌，拒绝非法步骤和多枚令牌', async () => {
    const path = '/api/playlists/900000019/tracks';
    const request = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ songIds: [3433267939] }),
    };
    expect((await api(path, request)).status).toBe(400);
    expect(
      (await api(path, request, { requests: ['first', 'spare'] })).status,
    ).toBe(400);
    expect(
      (
        await api(
          path,
          {
            ...request,
            headers: {
              ...request.headers,
              [PLAYLIST_TRACKS_STEP_HEADER]: 'unknown',
            },
          },
          { requests: ['one-token'] },
        )
      ).status,
    ).toBe(400);
    for (const step of ['initial', 'fallback']) {
      const response = await api(
        path,
        {
          ...request,
          headers: { ...request.headers, [PLAYLIST_TRACKS_STEP_HEADER]: step },
        },
        { requests: [`mock-${step}`] },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ kind: 'done' });
    }
    await fetch(`${origin}/api/mock/reset`, { method: 'POST' });
  });

  it('512 初次写入只通知后备，后备完成后 HTTP 读回有新增曲目', async () => {
    await api('/api/mock/scenario', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'tracks-512' }),
    });
    const send = (step: string) =>
      api(
        '/api/playlists/900000019/tracks',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [PLAYLIST_TRACKS_STEP_HEADER]: step,
          },
          body: JSON.stringify({ songIds: [3433267939] }),
        },
        { requests: [`synthetic-${step}`] },
      );
    const initial = await send('initial');
    expect(initial.status).toBe(428);
    expect(initial.headers.get(PLAYLIST_TRACKS_STEP_HEADER)).toBe('fallback');
    expect(await initial.json()).toBeTruthy();
    const fallback = await send('fallback');
    expect(fallback.status).toBe(200);
    const detail = await api(
      '/api/playlists/900000019',
      {},
      { requests: ['read-back'] },
    );
    expect(JSON.stringify(await detail.json())).toContain('3433267939');
    await api('/api/mock/reset', { method: 'POST' });
  });

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
  it('reset 清掉当前环境的图片直传，已清理的地址不再返回旧图片', async () => {
    const upload = await api('/api/mock/upload/reset-image', {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: 'synthetic-image',
    });
    expect(upload.status).toBe(200);
    expect(
      await api('/mock-assets/uploads/reset-image').then((r) => r.text()),
    ).toBe('synthetic-image');
    expect((await api('/api/mock/reset', { method: 'POST' })).status).toBe(200);
    expect((await api('/mock-assets/uploads/reset-image')).status).toBe(404);
  });
});
