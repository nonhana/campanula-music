import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { loadFixture } from '../_kit/fixtures.ts';
import { held } from '../_kit/hold.ts';
import { field, fixtureOutcome } from '../_kit/mock/fixture-format.ts';
import { mockPlugin } from '../_kit/mock/vite-plugin.ts';
import { sdkSchema, validateResponse } from '../_kit/sdk-contract.ts';
import { replaceSdk } from '../_kit/world.ts';

describe('sDK 消费者合同', () => {
  it('完整内容经结构化复制后复用证据，改值后仍拒绝', async () => {
    const sample = await loadFixture('library/playlist_detail.own-small.json');
    const { standard } = sdkSchema('PlaylistDetailBody');
    const validate = vi.spyOn(standard, 'validate');
    try {
      await validateResponse(
        'playlist_detail',
        sample.outcome.response,
        false,
        '原内容',
      );
      validate.mockClear();
      const copy = structuredClone(sample.outcome.response);
      await validateResponse('playlist_detail', copy, false, '复制内容');
      expect(validate).not.toHaveBeenCalled();
      const playlist = field(copy.body, 'playlist');
      if (typeof playlist !== 'object' || playlist === null)
        throw new Error('缺少歌单');
      Reflect.set(playlist, 'name', Number.NaN);
      await expect(
        validateResponse('playlist_detail', copy, false, '改坏复制内容'),
      ).rejects.toThrow('改坏复制内容');
      expect(validate).toHaveBeenCalled();
    } finally {
      validate.mockRestore();
    }
  });

  it('异步 schema 校验使用调用时的内容，不把中途修改后的成功记给旧内容', async () => {
    const sample = await loadFixture('library/playlist_detail.own-small.json');
    const response = structuredClone(sample.outcome.response);
    const playlist = field(response.body, 'playlist');
    if (typeof playlist !== 'object' || playlist === null)
      throw new Error('歌单样本缺少 playlist');
    Reflect.set(playlist, 'name', Number.NaN);
    const reached = held();
    const completion = held();
    const { standard } = sdkSchema('PlaylistDetailBody');
    const validate = standard.validate;
    const delayed = vi
      .spyOn(standard, 'validate')
      .mockImplementation(async (input) => {
        reached.release();
        await completion.until;
        return validate(input);
      });
    try {
      const checking = validateResponse(
        'playlist_detail',
        response,
        false,
        '异步快照',
      );
      const rejected = expect(checking).rejects.toThrow(/异步快照/);
      await reached.until;
      Reflect.set(playlist, 'name', null);
      completion.release();
      await rejected;
    } finally {
      completion.release();
      delayed.mockRestore();
    }
  });

  it('普通 Proxy 交给 SDK 校验，不因内容指纹拒绝合法回复', async () => {
    const sample = await loadFixture('library/playlist_detail.own-small.json');
    const body = structuredClone(sample.outcome.response.body);
    if (typeof body !== 'object' || body === null)
      throw new Error('歌单样本不是对象');
    await validateResponse(
      'playlist_detail',
      { ...sample.outcome.response, body: new Proxy(body, {}) },
      false,
      'Proxy 回复',
    );
  });

  it('已通过的内容改变后仍校验，null 和 NaN 不混用证据', async () => {
    const sample = await loadFixture('library/playlist_detail.own-small.json');
    const response = structuredClone(sample.outcome.response);
    const playlist = field(response.body, 'playlist');
    if (typeof playlist !== 'object' || playlist === null)
      throw new Error('歌单样本缺少 playlist');
    Reflect.set(playlist, 'name', null);
    await validateResponse('playlist_detail', response, false, '可空名称');
    await validateResponse(
      'playlist_detail',
      structuredClone(response),
      false,
      '相同内容',
    );
    Reflect.set(playlist, 'name', Number.NaN);
    await expect(
      validateResponse('playlist_detail', response, false, '改坏名称'),
    ).rejects.toThrow(/改坏名称/);
  });

  it('最终动态 body 和失败元数据均要符合合同', async () => {
    const sample = await loadFixture('playback/song_url_v1.vip-exhigh.json');
    await validateResponse(
      'song_url_v1',
      sample.outcome.response,
      false,
      '播放',
    );
    await expect(
      validateResponse(
        'song_url_v1',
        {
          ...sample.outcome.response,
          body: { code: 200, data: '错误' },
        },
        false,
        '播放',
      ),
    ).rejects.toThrow(/播放.*song_url_v1/);
    await expect(
      validateResponse(
        'like',
        {
          status: 405,
          body: { code: 405 },
          cookie: [],
        },
        true,
        '红心',
      ),
    ).rejects.toThrow(/failure/);
    const failed = fixtureOutcome('like', {
      status: 200,
      body: { code: 405, msg: '操作过于频繁' },
    });
    await validateResponse(
      'like',
      { ...failed.response, cookie: [] },
      true,
      '红心',
    );
  });
});

it('严格队列记住已捕获的意外调用、遗漏和顺序错误，允许声明并发', async () => {
  const queue = await import('../_kit/netease-sdk.ts');
  const sample = await loadFixture('playlist-edit/playlist_name_update.json');
  queue.reset();
  queue.queueReply('playlist_name_update', {
    ...sample.outcome,
    when: { id: 12, name: '新名' },
    fixture: '改名',
    required: true,
  });
  await expect(
    queue.invokeModule('playlist_name_update', { id: 13, name: '新名' }),
  ).rejects.toThrow();
  expect(() => queue.assertComplete()).toThrow(/playlist_name_update.*13/);
  queue.reset();
  queue.queueReply('playlist_name_update', {
    ...sample.outcome,
    when: { id: 12 },
    fixture: '遗漏',
    required: true,
  });
  expect(() => queue.assertComplete()).toThrow(/遗漏/);
  queue.reset();
  queue.queueReply('playlist_name_update', {
    ...sample.outcome,
    when: { id: 12 },
    fixture: '第一步',
    required: true,
  });
  queue.queueReply('playlist_name_update', {
    ...sample.outcome,
    when: { id: 13, name: '新名' },
    fixture: '第二步',
    required: true,
  });
  await expect(
    queue.invokeModule('playlist_name_update', { id: 13, name: '新名' }),
  ).rejects.toThrow(/顺序/);
  queue.reset();
  queue.allowAnyOrder();
  queue.queueReply('playlist_name_update', {
    ...sample.outcome,
    when: { id: 12 },
    required: true,
  });
  queue.queueReply('playlist_name_update', {
    ...sample.outcome,
    when: { id: 13, name: '新名' },
    required: true,
  });
  await Promise.all([
    queue.invokeModule('playlist_name_update', { id: 13, name: '新名' }),
    queue.invokeModule('playlist_name_update', { id: 12, name: '新名' }),
  ]);
  queue.assertComplete();
  queue.reset();
});

it('消费者清单从生产源码读取，每个 action 绑定、查询合同和样本均有证据', async () => {
  const { sdkReport } = await import('../tools/sdk-report.mts');
  const report = await sdkReport();
  expect(
    report.actions.find((action) => action.module === 'scrobble')?.failureGap,
  ).toBe(true);
  expect(
    report.actions.find((action) => action.module === 'scrobble')
      ?.anyFailureGap,
  ).toBe(false);
  expect(report.actions).toHaveLength(42);
  expect(report.dynamic).toHaveLength(42);
  expect(
    report.actions.find((action) => action.action === 'playlistTracks'),
  ).toMatchObject({
    module: 'playlist_tracks',
    required: ['op', 'pid', 'tracks'],
  });
  expect(report.samples['direct-upload']).toBe(3);
  expect(report.samples['normalized-failure']).toBeGreaterThan(30);
  expect(report.actions.every((action) => action.success.length > 0)).toBe(
    true,
  );
}, 90_000);

it('最终实体编号必须与查询相符，查询校验被产品捕获后收尾仍失败', async () => {
  const sample = await loadFixture(
    'library/playlist_detail.liked-full.json.gz',
  );
  await expect(
    validateResponse(
      'playlist_detail',
      sample.outcome.response,
      false,
      '错误实体',
      { id: 42 },
    ),
  ).rejects.toThrow(/错误实体.*playlist_detail/);
  const queue = await import('../_kit/netease-sdk.ts');
  queue.reset();
  await expect(
    queue.invokeModule('playlist_detail', { id: '42' }),
  ).rejects.toThrow();
  expect(() => queue.assertComplete()).toThrow(/关键输入/);
  queue.reset();
});

it('浏览器直传核对 HTTP 结果与上传字节数，失败不伪装成 SDK 成功', async () => {
  const response = {
    status: 200,
    cookie: [],
    body: { offset: 80, requestId: 'synthetic-upload' },
  };
  await validateResponse('nos_upload', response, false, '封面直传', {
    bytes: 80,
  });
  await expect(
    validateResponse('nos_upload', response, false, '封面直传', { bytes: 81 }),
  ).rejects.toThrow(/bytes/);
  await expect(
    validateResponse(
      'nos_upload',
      { ...response, status: 403 },
      false,
      '封面直传',
    ),
  ).rejects.toThrow(/HTTP/);
  await validateResponse(
    'nos_upload',
    { status: 403, cookie: [], body: {} },
    true,
    '封面直传',
  );
});

it('最终队列拒绝错实体、成功错分和缺少登录 Cookie', async () => {
  const queue = await import('../_kit/netease-sdk.ts');
  queue.reset();
  const detail = await loadFixture(
    'library/playlist_detail.liked-full.json.gz',
  );
  queue.queueReply('playlist_detail', {
    ...detail.outcome,
    when: { id: 42 },
    required: true,
  });
  await expect(
    queue.invokeModule('playlist_detail', { id: 42 }),
  ).rejects.toThrow(/实体/);
  expect(() => queue.assertComplete()).toThrow(/实体/);
  queue.reset();
  await expect(
    validateResponse(
      'like',
      {
        status: 200,
        body: { code: 200 },
        cookie: [],
        failure: { kind: 'business', code: 200 },
      },
      true,
      '错分',
    ),
  ).rejects.toThrow(/失败/);
  const login = await loadFixture('login/login_qr_check.803-success.json');
  queue.queueReply('login_qr_check', {
    ...login.outcome,
    required: true,
    when: { key: 'synthetic' },
  });
  await expect(
    queue.invokeModule('login_qr_check', { key: 'synthetic' }),
  ).rejects.toThrow(/MUSIC_U/);
  expect(() => queue.assertComplete()).toThrow(/MUSIC_U/);
  queue.reset();
});

it('sDK 允许没有业务 code 的失败，以及各类技术失败', async () => {
  expect(
    await validateResponse(
      'like',
      {
        status: 400,
        body: {},
        cookie: [],
        failure: { kind: 'business', code: null },
      },
      true,
      '无码失败',
    ),
  ).toBe('normalized-failure');
  for (const kind of [
    'timeout',
    'cancelled',
    'invalidRequest',
    'transport',
    'unknown',
  ] as const) {
    expect(
      await validateResponse(
        'like',
        { status: 500, body: { code: 500 }, cookie: [], failure: { kind } },
        true,
        kind,
      ),
    ).toBe('normalized-failure');
  }
});

it('测试与 mock 替身只放行已登记子路径与合法边界，拒绝未登记或内部子路径', () => {
  const resolveWith = (
    plugin: ReturnType<typeof replaceSdk>,
    id: string,
    importer: string,
  ) => {
    const hook = plugin.resolveId as (
      this: unknown,
      source: string,
      importer?: string,
    ) => unknown;
    return hook.call({}, id, importer);
  };
  const fakeSdk = fileURLToPath(
    new URL('../_kit/netease-sdk.ts', import.meta.url),
  );
  const runtime = fileURLToPath(
    new URL('../_kit/mock/runtime.ts', import.meta.url),
  );
  const sdkContract = fileURLToPath(
    new URL('../_kit/sdk-contract.ts', import.meta.url),
  );
  const serverFile = fileURLToPath(
    new URL('../../src/lib/server/netease/library.ts', import.meta.url),
  );
  const worldPlugin = replaceSdk();
  const mock = mockPlugin();

  expect(
    resolveWith(worldPlugin, 'hana-music-api/api/song_detail', serverFile),
  ).toBe(fakeSdk);
  expect(resolveWith(worldPlugin, 'hana-music-api/utils', serverFile)).toBe(
    fakeSdk,
  );
  expect(
    resolveWith(worldPlugin, 'hana-music-api/watchman', serverFile),
  ).toBeNull();
  expect(resolveWith(mock, 'hana-music-api/api/song_detail', serverFile)).toBe(
    runtime,
  );
  expect(resolveWith(mock, 'hana-music-api/utils', serverFile)).toBe(runtime);
  expect(resolveWith(mock, 'hana-music-api/watchman', serverFile)).toBe(
    fileURLToPath(new URL('../_kit/mock/watchman.ts', import.meta.url)),
  );

  for (const [plugin, self] of [
    [worldPlugin, fakeSdk],
    [mock, runtime],
  ] as const) {
    expect(resolveWith(plugin, 'hana-music-api/utils', self)).toEqual({
      id: fileURLToPath(import.meta.resolve('hana-music-api/utils')),
      external: true,
    });
    expect(resolveWith(plugin, 'hana-music-api/schemas', sdkContract)).toEqual({
      id: fileURLToPath(import.meta.resolve('hana-music-api/schemas')),
      external: true,
    });
    expect(resolveWith(plugin, 'hana-music-api/utils', sdkContract)).toEqual({
      id: fileURLToPath(import.meta.resolve('hana-music-api/utils')),
      external: true,
    });
    for (const blocked of [
      'hana-music-api/api/user_detail',
      'hana-music-api/core',
      'hana-music-api/schemas',
      'hana-music-api/schemas/song_detail',
      'hana-music-api/dist/index.js',
      'hana-music-api/api/song_detail/extra',
    ])
      expect(() => resolveWith(plugin, blocked, serverFile)).toThrow(blocked);
  }
});
