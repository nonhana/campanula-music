import { describe, expect, it } from 'vitest';

import type { Song } from '#lib/api/library.js';

import { loadFixture } from './harness/fixtures';
import { held, never } from './harness/hold';
import {
  downloadCoverUrl,
  listener,
  PLAYLISTS_WITH_POEMS,
} from './harness/listener';
import { RECORDED_ACCOUNT } from './harness/sign-in';
import { useWorld } from './harness/world';

const world = useWorld();
const { signInAtHearts, reopen, replyLibrary, replyLikedSongs } = listener(
  world,
  { playlists: PLAYLISTS_WITH_POEMS },
);

type SongIn9 = Omit<
  Song,
  | 'trackNumber'
  | 'disc'
  | 'aliases'
  | 'translations'
  | 'publishedAt'
  | 'downloadSize'
>;

const NOT_GIVEN = {
  trackNumber: null,
  downloadSize: null,
  disc: null,
  aliases: [],
  translations: [],
  publishedAt: null,
};

const savedSong: SongIn9 = {
  id: 3433267939,
  name: '旧版存着的歌',
  artists: [{ id: 1, name: '旧版存着的歌手' }],
  album: {
    id: 1,
    name: '旧版存着的专辑',
    coverUrl: 'https://p1.music.126.net/placeholder/cover.jpg',
  },
  duration: 192648,
  availability: 'full',
};

const downloadedSong: SongIn9 = {
  id: 2662577181,
  name: '旧版下载的歌',
  artists: [{ id: 2, name: '旧版下载的歌手' }],
  album: { id: 2, name: '旧版下载的专辑', coverUrl: null },
  duration: 240413,
  availability: 'full',
};

describe('本机数据库升级', () => {
  it('v9 → v15：不用重新登录，曲库、播放队列和进度、设置、下载仍在；歌曲信息重新取（带上第几首等），旧的下载和播放队列里的歌补上“网易云没给”和“单独下载”来源', async () => {
    // 登录 Cookie 由真服务端签发，不手造密文
    const signedIn = world.device();
    const login = await signInAtHearts(signedIn);
    await world.settle();
    login.close();

    const device = world.device();
    for (const cookie of await signedIn.cookies())
      await device.setCookie(cookie.toString());
    await device.preload(9, (database) => {
      database.createObjectStore('session');
      const library = database.createObjectStore('library');
      library.put(10000001, 'owner');
      library.put([3433267939], 'hearts');
      library.put(
        [
          {
            id: 900000001,
            name: '我喜欢的音乐',
            kind: 'liked',
            private: false,
            coverUrl: 'https://p1.music.126.net/placeholder/cover.jpg',
            creator: '测试听众',
            playCount: 0,
            description: null,
            tags: [],
            trackCount: 2,
            tracksUpdatedAt: 1,
          },
        ],
        'playlists',
      );
      library.put([], 'collectedAlbums');
      library.put([], 'collectedArtists');
      database.createObjectStore('tracks').put(
        {
          version: 1,
          trackIds: [3433267939, 2662577181],
          complete: true,
        },
        900000001,
      );
      database.createObjectStore('songs', { keyPath: 'id' }).put(savedSong);
      database.createObjectStore('albumPages');
      const player = database.createObjectStore('player');
      player.put(
        {
          owner: 10000001,
          entries: [
            {
              song: savedSong,
              source: { kind: 'playlist', id: 900000001 },
            },
          ],
          mode: 'one',
          order: null,
          upNext: [],
          filling: null,
        },
        'queue',
      );
      player.put(
        {
          songId: 3433267939,
          position: 42,
          duration: 192.648,
          trial: false,
          listened: 12,
        },
        'progress',
      );
      const settings = database.createObjectStore('settings');
      settings.put('lossless', 'playQuality');
      settings.put(['夜に駆ける'], 'searchHistory');
      database.createObjectStore('checkIns', { autoIncrement: true });
      database.createObjectStore('downloads').put(
        {
          song: downloadedSong,
          audio: new Blob([new Uint8Array(1000)], { type: 'audio/mpeg' }),
          cover: null,
          lyrics: {
            kind: 'line',
            lines: [
              {
                start: 1,
                text: '旧版存着的歌词',
                words: null,
                translation: null,
                romanization: null,
              },
            ],
            translated: false,
            romanized: false,
          },
          downloadedAt: 1,
        },
        2662577181,
      );
    });

    const hearts = held();
    const tab = await reopen(device, undefined, { until: hearts.until });
    const { app } = tab;
    await world.settle();
    expect(app.state.session).toMatchObject({
      status: 'signedIn',
      account: RECORDED_ACCOUNT,
    });
    expect(
      app.state.library?.playlists?.map((playlist) => playlist.id),
    ).toEqual([900000001]);
    expect(app.state.library?.hearts?.has(3433267939)).toBe(true);
    expect(app.state.library?.liked).toMatchObject({
      total: 2,
      complete: false,
    });
    expect(app.state.player).toMatchObject({
      current: 0,
      position: 42,
      duration: 192.648,
      status: 'paused',
      mode: 'one',
      quality: 'lossless',
    });
    expect(app.state.player.queue).toEqual([
      {
        song: {
          ...savedSong,
          ...NOT_GIVEN,
        },
        source: { kind: 'playlist', id: 900000001 },
      },
    ]);
    expect(app.state.search.history).toEqual(['夜に駆ける']);
    expect(app.state.downloads.songs).toEqual([
      {
        ...downloadedSong,
        ...NOT_GIVEN,
      },
    ]);
    expect(app.state.downloads.sourcesOf(2662577181)).toEqual([
      { kind: 'single' },
    ]);
    expect(
      device.requests.some((request) => request.path.includes('/login/')),
    ).toBe(false);

    await replyLibrary({ from: 'playlists' });
    await replyLikedSongs();
    await replyLibrary({
      from: 'likedTracks',
      until: never(),
    });
    hearts.release();
    await world.settle();
    expect(app.state.library?.liked).toMatchObject({
      total: 4984,
      complete: true,
    });
    expect(
      device.requests.some((request) => request.path === '/api/songs'),
    ).toBe(true);
    expect(
      (await device.stored()).songs.find(([id]) => id === 3433267939)?.[1],
    ).toMatchObject({
      name: '夏に溶ける (feat. 鏡音リン)',
      trackNumber: 1,
      disc: '01',
      publishedAt: 1789315200000,
    });

    const song = app.state.library!.liked!.songs.find(
      (liked) => liked.id === 3433267939,
    )!;
    const fixture = 'playback/downloads/002-song_download_url_v1.json.gz';
    const { outcome } = await loadFixture(fixture);
    const { data } = outcome.response.body as {
      data: { url: string; size: number };
    };
    device.files.put(data.url.replace(/^http:/, 'https:'), {
      bytes: data.size,
      type: 'audio/mpeg',
    });
    device.files.put(downloadCoverUrl(song.album.coverUrl!), {
      bytes: 100,
      type: 'image/jpeg',
    });
    await world.netease.reply(fixture);
    await world.netease.reply('playback/lyric_new.all-forms.json');
    await world.netease.reply('playback/export/003-album.json.gz');
    app.download(song);
    await world.settle();
    expect(app.state.downloads.has(3433267939)).toBe(true);

    tab.close();
    const reopened = await reopen(device);
    expect(reopened.app.state.downloads.songs).toEqual([
      song,
      {
        ...downloadedSong,
        ...NOT_GIVEN,
      },
    ]);
    expect(reopened.app.state.player.position).toBe(42);
  });

  it('v4 → v15：歌单列表补上后加的字段；v5 删掉旧的歌曲信息和专辑页、每张歌单记成歌曲信息还没取全，下次同步重取；播放队列、设置、打卡、下载的存储区建好', async () => {
    // v4 还没有播放次数、简介、标签、能不能放，也没有播放队列、设置、打卡、下载的存储区
    const signedIn = world.device();
    const login = await signInAtHearts(signedIn);
    await world.settle();
    login.close();

    const device = world.device();
    for (const cookie of await signedIn.cookies())
      await device.setCookie(cookie.toString());
    const oldPlaylist = {
      id: 900000001,
      name: '我喜欢的音乐',
      kind: 'liked',
      private: false,
      coverUrl: 'https://p1.music.126.net/placeholder/cover.jpg',
      creator: '测试听众',
      trackCount: 2,
      tracksUpdatedAt: 1,
    };
    const oldSong = {
      id: 3433267939,
      name: '旧版存着的歌',
      artists: [{ id: 1, name: '旧版存着的歌手' }],
      album: {
        id: 1,
        name: '旧版存着的专辑',
        coverUrl: 'https://p1.music.126.net/placeholder/cover.jpg',
      },
      duration: 192648,
    };
    await device.preload(4, (database) => {
      database.createObjectStore('session');
      const library = database.createObjectStore('library');
      library.put(10000001, 'owner');
      library.put([3433267939], 'hearts');
      library.put([oldPlaylist], 'playlists');
      library.put(
        [
          {
            id: 3149073,
            name: '旧版收藏的专辑',
            coverUrl: null,
            artists: [],
            songCount: 10,
          },
        ],
        'collectedAlbums',
      );
      library.put([], 'collectedArtists');
      database.createObjectStore('tracks').put(
        {
          version: 1,
          trackIds: [3433267939, 2662577181],
          complete: true,
        },
        900000001,
      );
      database.createObjectStore('songs', { keyPath: 'id' }).put(oldSong);
      database.createObjectStore('albumPages').put(
        {
          album: { id: 3149073, name: '旧版收藏的专辑' },
          songs: [],
        },
        3149073,
      );
    });

    const hearts = held();
    const tab = await reopen(device, undefined, { until: hearts.until });
    const { app } = tab;
    await world.settle();

    expect(app.state.session).toMatchObject({
      status: 'signedIn',
      account: RECORDED_ACCOUNT,
    });
    expect(app.state.library?.playlists).toEqual([
      {
        ...oldPlaylist,
        creatorAvatarUrl: null,
        playCount: 0,
        description: null,
        tags: [],
      },
    ]);
    expect(app.state.library?.liked).toMatchObject({
      total: 2,
      complete: false,
    });
    expect(
      device.requests.some((request) => request.path.includes('/login/')),
    ).toBe(false);

    const upgraded = await device.stored();
    expect(upgraded.songs).toEqual([]);
    expect(upgraded.albumPages).toEqual([]);
    expect(upgraded.tracks.find(([id]) => id === 900000001)?.[1]).toMatchObject(
      {
        trackIds: [3433267939, 2662577181],
        complete: false,
      },
    );
    expect(upgraded.player).toEqual([]);
    expect(upgraded.settings).toEqual([]);
    expect(upgraded.checkIns).toEqual([]);
    expect(upgraded.downloads).toEqual([]);

    await replyLibrary({ from: 'playlists' });
    await replyLikedSongs();
    await replyLibrary({
      from: 'likedTracks',
      until: never(),
    });
    hearts.release();
    await world.settle();
    expect(
      device.requests.some((request) => request.path === '/api/songs'),
    ).toBe(true);
    expect(
      (await device.stored()).songs.find(([id]) => id === 3433267939)?.[1],
    ).toMatchObject({
      name: '夏に溶ける (feat. 鏡音リン)',
      availability: 'full',
      trackNumber: 1,
      disc: '01',
    });

    await world.netease.reply('library/album-artist/008-album.json.gz');
    await app.openAlbum(3149073);
    await world.settle();
    expect(
      world.netease.calls.findLast((call) => call.module === 'album'),
    ).toMatchObject({
      query: { id: 3149073 },
    });
    expect(app.state.library?.albumPage(3149073)).toMatchObject({
      status: 'shown',
    });
    expect((await device.stored()).albumPages.map(([id]) => id)).toEqual([
      3149073,
    ]);
  });

  it('v13（#41 第一轮留下的，已回滚）→ v15：照样打开、不用重新登录，曲库、设置和下载都在；那一轮加的两个存储区删掉', async () => {
    const signedIn = world.device();
    const login = await signInAtHearts(signedIn);
    await world.settle();
    login.close();

    const device = world.device();
    for (const cookie of await signedIn.cookies())
      await device.setCookie(cookie.toString());
    const song: Song = {
      ...savedSong,
      ...NOT_GIVEN,
    };
    const downloaded: Song = {
      ...downloadedSong,
      ...NOT_GIVEN,
    };
    const fromPlaylist = {
      kind: 'playlist',
      id: 900000001,
      name: '我喜欢的音乐',
    } as const;
    await device.preload(13, (database) => {
      database.createObjectStore('session');
      const library = database.createObjectStore('library');
      library.put(10000001, 'owner');
      library.put([3433267939], 'hearts');
      library.put(
        [
          {
            id: 900000001,
            name: '我喜欢的音乐',
            kind: 'liked',
            private: false,
            coverUrl: 'https://p1.music.126.net/placeholder/cover.jpg',
            creator: '测试听众',
            creatorAvatarUrl: null,
            playCount: 0,
            description: null,
            tags: [],
            trackCount: 1,
            tracksUpdatedAt: 1,
          },
        ],
        'playlists',
      );
      library.put([], 'collectedAlbums');
      library.put([], 'collectedArtists');
      database.createObjectStore('tracks').put(
        {
          version: 1,
          trackIds: [3433267939],
          complete: true,
        },
        900000001,
      );
      database.createObjectStore('songs', { keyPath: 'id' }).put(song);
      database.createObjectStore('albumPages');
      database.createObjectStore('player');
      database
        .createObjectStore('settings')
        .put(['夜に駆ける'], 'searchHistory');
      database.createObjectStore('checkIns', { autoIncrement: true });
      database.createObjectStore('downloads').put(
        {
          song: downloaded,
          audio: new Blob([new Uint8Array(1000)], { type: 'audio/mpeg' }),
          cover: null,
          lyrics: { kind: 'none' },
          album: null,
          sources: [fromPlaylist],
          downloadedAt: 1,
        },
        2662577181,
      );
      database.createObjectStore('downloadQueue').put(
        [
          {
            song,
            sources: [fromPlaylist],
          },
        ],
        'queue',
      );
      database.createObjectStore('backgroundDownloads').put(
        {
          name: 'downloads-1-1',
          entries: [],
        },
        'downloads-1-1',
      );
    });

    const { app } = await reopen(device);
    await world.settle();
    expect(app.state.session).toMatchObject({
      status: 'signedIn',
      account: RECORDED_ACCOUNT,
    });
    expect(
      device.requests.some((request) => request.path.includes('/login/')),
    ).toBe(false);
    expect(
      app.state.library?.playlists?.map((playlist) => playlist.id),
    ).toEqual([900000001]);
    expect(app.state.library?.hearts?.has(3433267939)).toBe(true);
    expect(app.state.search.history).toEqual(['夜に駆ける']);
    expect(app.state.downloads.songs).toEqual([downloaded]);
    expect(app.state.downloads.sourcesOf(2662577181)).toEqual([fromPlaylist]);
    expect(Object.keys(await device.stored()).sort()).toEqual([
      'albumPages',
      'checkIns',
      'downloadParts',
      'downloadQueue',
      'downloads',
      'library',
      'player',
      'session',
      'settings',
      'songs',
      'tracks',
    ]);
  });

  it('v14 → v15：照样打开、不用重新登录，曲库、设置和下载都在；排队中、下了一半的下载的存储区建好', async () => {
    const signedIn = world.device();
    const login = await signInAtHearts(signedIn);
    await world.settle();
    login.close();

    const device = world.device();
    for (const cookie of await signedIn.cookies())
      await device.setCookie(cookie.toString());
    const downloaded: Song = {
      ...downloadedSong,
      ...NOT_GIVEN,
    };
    await device.preload(14, (database) => {
      database.createObjectStore('session');
      const library = database.createObjectStore('library');
      library.put(10000001, 'owner');
      library.put([3433267939], 'hearts');
      library.put([], 'playlists');
      library.put([], 'collectedAlbums');
      library.put([], 'collectedArtists');
      database.createObjectStore('tracks');
      database.createObjectStore('songs', { keyPath: 'id' });
      database.createObjectStore('albumPages');
      database.createObjectStore('player');
      database
        .createObjectStore('settings')
        .put(['夜に駆ける'], 'searchHistory');
      database.createObjectStore('checkIns', { autoIncrement: true });
      database.createObjectStore('downloads').put(
        {
          song: downloaded,
          audio: new Blob([new Uint8Array(1000)], { type: 'audio/mpeg' }),
          cover: null,
          lyrics: { kind: 'none' },
          album: null,
          sources: [{ kind: 'single' }],
          downloadedAt: 1,
        },
        downloaded.id,
      );
    });

    const { app } = await reopen(device);
    await world.settle();

    expect(app.state.session).toMatchObject({
      status: 'signedIn',
      account: RECORDED_ACCOUNT,
    });
    expect(
      device.requests.some((request) => request.path.includes('/login/')),
    ).toBe(false);
    expect(app.state.library?.hearts?.has(3433267939)).toBe(true);
    expect(app.state.search.history).toEqual(['夜に駆ける']);
    expect(app.state.downloads.songs).toEqual([downloaded]);
    expect(app.state.downloads.sourcesOf(downloaded.id)).toEqual([
      { kind: 'single' },
    ]);
    expect((await device.stored()).downloadQueue).toEqual([]);
    expect((await device.stored()).downloadParts).toEqual([]);
  });
});
