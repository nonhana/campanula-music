import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { expect, it } from 'vitest';

import { loadFixture } from '../_kit/fixtures.ts';
import { buildIndex } from '../tools/fixture-index.mts';
import type { Authorization, Invoke } from '../tools/netease-record.mts';
import { withRecording } from '../tools/netease-record.mts';

const identity = {
  self: {
    uid: 1234567,
    nickname: '私有"测试名',
    fakeUid: 10000001,
    fakeNickname: '测试听众',
  },
  artist: {
    id: 1234568,
    name: '私有歌手',
    fakeId: 910000001,
    fakeName: '测试歌手',
  },
  playlists: {},
  works: {},
  users: {},
  next: {
    user: 10000010,
    playlist: 900000100,
    song: 910000100,
    album: 920000100,
  },
};

it.each(['私有"测试名', 'code', 'null'])(
  '模拟采集源录成功和失败，脱敏后可重放并清理（%s）',
  async (nickname) => {
    const root = await mkdtemp(join(tmpdir(), 'campanula-record-'));
    const authPath = join(root, 'auth.json');
    const output = join(root, 'samples');
    const auth: Authorization = {
      instance: 'http://127.0.0.1:9999',
      expiresAt: Date.now() + 60_000,
      deviceId: 'synthetic-device',
      credentials: { MUSIC_U: 'synthetic-private-session' },
      identity: {
        ...structuredClone(identity),
        self: { ...identity.self, nickname },
      },
    };
    const source: Invoke = async (module) => {
      if (module === 'user_account') {
        const { outcome } = await loadFixture('login/user_account.vip.json');
        return {
          ok: true,
          status: 200,
          body: {
            ...(outcome.response.body as object),
            account: { id: 1234567, anonimousUser: false },
            profile: { userId: 1234567, nickname },
          },
        } as Awaited<ReturnType<Invoke>>;
      }
      if (module === 'login_cellphone')
        return {
          ok: false,
          status: 403,
          body: { code: 403, message: '合成拒绝：13912345678 / 864213' },
        };
      if (module === 'playlist_name_update')
        return {
          ok: false,
          status: 403,
          body: {
            code: 403,
            message: `拒绝: ${nickname}`,
            token: 'synthetic-private-session',
            userId: 1234567,
            nickname,
          },
        };
      return {
        ok: true,
        status: 200,
        body: {
          code: 200,
          ids: [1],
          token: 'synthetic-private-session',
          nullable: null,
        },
      } as Awaited<ReturnType<Invoke>>;
    };
    try {
      await writeFile(authPath, JSON.stringify(auth), { mode: 0o600 });
      await withRecording(
        {
          instance: auth.instance,
          authorizationFile: authPath,
          source,
          dir: output,
        },
        async (recorder) => {
          await recorder.call('login_cellphone', {
            phone: '13912345678',
            captcha: '864213',
            countrycode: 86,
          });
          await recorder.call('likelist', { uid: 1234567 });
          await recorder.call('playlist_name_update', {
            id: 900000019,
            name: '测试',
          });
        },
      );
      await expect(readFile(authPath)).rejects.toMatchObject({
        code: 'ENOENT',
      });
      const index = await buildIndex(output);
      expect(index.entries.map((entry) => entry.validation).sort()).toEqual([
        'normalized-failure',
        'normalized-failure',
        'success-schema',
      ]);
      expect(await buildIndex(output)).toEqual(index);
      for (const path of await readdir(output)) {
        const text = gunzipSync(await readFile(join(output, path))).toString();
        expect(text).not.toMatch(
          /synthetic-private-session|1234567|私有"测试名|13912345678|864213/,
        );
        const raw = JSON.parse(text);
        expect(raw.response.body.code).toBe(
          raw.module === 'likelist' ? 200 : 403,
        );
        if (raw.module === 'likelist')
          expect(raw.response.body.nullable).toBeNull();
        if (raw.module === 'playlist_name_update')
          expect(raw.response.body.message).toBe('拒绝: 测试听众');
        expect(raw.context.instance).toBe(auth.instance);
        expect(raw.context.sdk).toBe(index.checkedWith);
        await loadFixture(path, new URL(`file://${output}/`));
      }
      await writeFile(authPath, JSON.stringify({ ...auth, expiresAt: 0 }), {
        mode: 0o600,
      });
      await expect(
        withRecording(
          {
            instance: auth.instance,
            authorizationFile: authPath,
            source,
            dir: output,
          },
          async () => {},
        ),
      ).rejects.toThrow(/过期/);
      await expect(readFile(authPath)).rejects.toMatchObject({
        code: 'ENOENT',
      });
      await writeFile(
        authPath,
        JSON.stringify({ ...auth, credentials: { MUSIC_U: 'synthetic' } }),
        { mode: 0o600 },
      );
      await expect(
        withRecording(
          {
            instance: auth.instance,
            authorizationFile: authPath,
            source: async () => {
              throw new Error('合成源异常');
            },
            dir: output,
          },
          async () => {},
        ),
      ).rejects.toThrow('合成源异常');
      await expect(readFile(authPath)).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

it.each(['invalid-expiry', 'string', 'boolean', 'number', 'missing-counter'])(
  '无效临时授权在调用采集源前拒绝并删除文件（%s）',
  async (kind) => {
    const root = await mkdtemp(join(tmpdir(), 'campanula-record-invalid-'));
    const path = join(root, 'auth.json');
    let calls = 0;
    const source: Invoke = async () => {
      calls += 1;
      throw new Error('不应调用采集源');
    };
    const valid = {
      instance: 'http://127.0.0.1:9999',
      expiresAt: Date.now() + 60_000,
      deviceId: 'synthetic',
      credentials: { MUSIC_U: 'synthetic' },
      identity: structuredClone(identity),
    };
    const payload =
      kind === 'string'
        ? 'bad'
        : kind === 'boolean'
          ? true
          : kind === 'number'
            ? 42
            : kind === 'missing-counter'
              ? { ...valid, identity: { ...valid.identity, next: {} } }
              : { ...valid, expiresAt: 'invalid' };
    try {
      await writeFile(path, JSON.stringify(payload), { mode: 0o600 });
      await expect(
        withRecording(
          {
            instance: valid.instance,
            authorizationFile: path,
            source,
            dir: join(root, 'output'),
          },
          async () => {},
        ),
      ).rejects.toThrow(/授权/);
      expect(calls).toBe(0);
      await expect(readFile(path)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
