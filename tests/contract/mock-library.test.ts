import { expect, it } from 'vitest';

import {
  configure,
  invokeModule,
  loginCredentials,
  reset,
  status,
} from '../_kit/mock/runtime.ts';

const config = { cookie: loginCredentials().credentials };

it('默认小曲库的收藏可完整打开，歌曲可播放下载，写后读回和 reset 保持一致', async () => {
  await reset();
  expect(status().seed).toBe('small');
  const call = async (module: string, query = {}) =>
    (await invokeModule(module, query, config)).body as Record<string, any>;
  const albums = await call('album_sublist', { offset: 0, limit: 1000 });
  expect(albums.data).toHaveLength(1);
  expect(albums.data[0].size).toBe(6);
  for (const album of albums.data)
    expect((await call('album', { id: album.id })).album.id).toBe(album.id);
  const artists = await call('artist_sublist', { offset: 0, limit: 1000 });
  expect(artists.data).toHaveLength(1);
  for (const artist of artists.data) {
    expect(
      (
        await call('artist_songs', {
          id: artist.id,
          order: 'hot',
          offset: 0,
          limit: 100,
        })
      ).songs.length,
    ).toBeGreaterThan(0);
    expect(
      (await call('artist_album', { id: artist.id, offset: 0, limit: 100 }))
        .hotAlbums[0].id,
    ).toBe(albums.data[0].id);
  }
  expect(
    (await call('artist_album', { id: 33927412, offset: 0, limit: 100 }))
      .artist,
  ).toMatchObject({ name: '测试歌手', musicSize: 6, albumSize: 1 });
  const lists = await call('user_playlist', { uid: 10000001, limit: 1000 });
  for (const item of lists.playlist) {
    const detail = await call('playlist_detail', { id: item.id });
    const ids = detail.playlist.trackIds.map(
      (track: { id: number }) => track.id,
    );
    expect((await call('song_detail', { ids })).songs).toHaveLength(ids.length);
  }
  const id = 3433267939;
  expect(
    (await call('song_url_v1', { ids: [id], level: 'exhigh' })).data[0].url,
  ).toMatch('/mock-assets/audio/');
  expect(
    (await call('song_download_url_v1', { id, level: 'exhigh' })).data.size,
  ).toBe(32044);
  expect((await call('lyric_new', { id })).lrc.lyric).toBeTruthy();
  await call('playlist_name_update', { id: 900000019, name: '读回' });
  expect((await call('playlist_detail', { id: 900000019 })).playlist.name).toBe(
    '读回',
  );
  await reset();
  expect((await call('playlist_detail', { id: 900000019 })).playlist.name).toBe(
    'poems',
  );
  await configure('large');
  expect((await call('likelist', { uid: 10000001 })).ids).toHaveLength(4984);
});

it('扫码确认或过期、合法空搜索、512 写入和缺关系有具名诊断', async () => {
  const body = async (module: string, query = {}) =>
    (await invokeModule(module, query, config)).body as Record<string, any>;
  await configure('qr-confirm');
  for (const code of [801, 802, 803]) {
    const response = await invokeModule('login_qr_check', {
      key: 'synthetic-qr',
    });
    expect((response.body as { code: number }).code).toBe(code);
    expect(
      response.cookie.some((cookie) => cookie.startsWith('MUSIC_U=')),
    ).toBe(code === 803);
  }
  await configure('qr-expired');
  expect((await body('login_qr_check', { key: 'synthetic-qr' })).code).toBe(
    801,
  );
  expect((await body('login_qr_check', { key: 'synthetic-qr' })).code).toBe(
    800,
  );
  await configure('empty-search');
  expect(
    (
      await body('cloudsearch', {
        keywords: '不存在',
        type: 1,
        offset: 0,
        limit: 30,
      })
    ).result,
  ).toEqual({ songs: [], songCount: 0 });
  await configure('tracks-512');
  await expect(
    body('playlist_tracks', {
      op: 'add',
      pid: 900000019,
      tracks: [3433267939],
      step: 'initial',
    }),
  ).rejects.toMatchObject({ failure: { kind: 'business', code: 512 } });
  expect(
    (await body('playlist_detail', { id: 900000019 })).playlist.trackCount,
  ).toBe(2);
  await body('playlist_tracks', {
    op: 'add',
    pid: 900000019,
    tracks: [3433267939],
    step: 'fallback',
  });
  expect(
    (await body('playlist_detail', { id: 900000019 })).playlist.trackCount,
  ).toBe(3);
  await configure('rate-limited');
  await expect(body('likelist', { uid: 10000001 })).rejects.toMatchObject({
    retryAfter: 30,
  });
  await reset();
  expect((await body('likelist', { uid: 10000001 })).ids).toHaveLength(2);
  await configure('missing-relation');
  await expect(body('album', { id: 3149073 })).rejects.toMatchObject({
    status: 500,
  });
  const { coverage } = await import('../_kit/mock/runtime.ts');
  expect((await coverage()).misses).toContainEqual({
    scenario: 'missing-relation',
    module: 'album',
    query: { id: 3149073 },
  });
  await reset();
});

it('全部搜索类别都支持具名合法空态', async () => {
  await configure('empty-search');
  for (const [type, items, count] of [
    [1, 'songs', 'songCount'],
    [10, 'albums', 'albumCount'],
    [100, 'artists', 'artistCount'],
    [1000, 'playlists', 'playlistCount'],
  ] as const) {
    const response = await invokeModule(
      'cloudsearch',
      { keywords: '不存在', type, limit: 30, offset: 0 },
      config,
    );
    expect(response.body).toEqual({
      code: 200,
      result: { [items]: [], [count]: 0 },
    });
  }
  await reset();
});
