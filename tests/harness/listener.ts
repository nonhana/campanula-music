import { readdir } from 'node:fs/promises';

import type { Playlist, Song } from '#lib/api/library.js';
import type { App } from '#lib/app/app.js';
import type { NoticeEntry, OperationNotice } from '#lib/app/notice.js';

import type { Device, SentRequest, Tab } from './device';
import { loadFixture } from './fixtures';
import { never } from './hold';
import { LIBRARY_SYNC_MODULES, signIn } from './sign-in';
import type { World } from './world';

export const HEARTS = 'library/likelist.json';
export const PLAYLISTS_WITH_POEMS =
  'library/sync/before/001-user_playlist.json.gz';
const PLAYLISTS_WITHOUT_POEMS =
  'library/sync/deleted/001-user_playlist.json.gz';
export const COLLECTED_ALBUMS =
  'library/album-artist/001-album_sublist.json.gz';
export const COLLECTED_ARTISTS =
  'library/album-artist/002-artist_sublist.json.gz';
export const LIKED_TRACK_IDS = 'library/playlist_detail.liked-full.json.gz';
export const likedPage = (page: number) =>
  `library/song_detail.liked-page${page}.json.gz`;
export const DAILY = 'discover/daily/001-recommend_songs.json.gz';
export const JAZZ_DETAIL = 'library/sync/before/004-playlist_detail.json.gz';
export const SOME_SONGS = 'library/sync/before/003-song_detail.json.gz';
export const DOWNLOAD_LYRICS = 'playback/lyric_new.all-forms.json';
export const ALBUM_MISSING = 'playback/export/003-album.json.gz';

export const VILLAGE = {
  id: 3149073,
  page: 'library/album-artist/008-album.json.gz',
  fightOrFlight: {
    id: 34586046,
    downloadUrl: 'playback/export/001-song_download_url_v1.json.gz',
  },
  sunny: {
    id: 34586048,
    downloadUrl: 'playback/export/002-song_download_url_v1.json.gz',
  },
};

export interface Downloadable {
  id: number;
  downloadUrl: string;
}

export interface RecordedPlaylist {
  id: number;
  detail: string;
  trackIds: number[];
  pages: { fixture: string; ids: number[] }[];
}

export const recordedBatch = async (
  name: 'before' | 'after' | 'deleted',
): Promise<{ list: string; playlists: RecordedPlaylist[] }> => {
  const dir = `library/sync/${name}`;
  const files = (
    await readdir(new URL(`../fixtures/netease/${dir}`, import.meta.url))
  )
    .sort()
    .map((file) => `${dir}/${file}`);
  const playlists: RecordedPlaylist[] = [];
  for (const fixture of files.slice(1)) {
    const { module, query, outcome } = await loadFixture(fixture);
    if (module === 'playlist_detail') {
      const body = outcome.response.body as {
        playlist: { trackIds: { id: number }[] };
      };
      playlists.push({
        id: query.id as number,
        detail: fixture,
        trackIds: body.playlist.trackIds.map((track) => track.id),
        pages: [],
      });
    } else {
      playlists.at(-1)!.pages.push({
        fixture,
        ids: (query.ids as string).split(',').map(Number),
      });
    }
  }
  return { list: files[0], playlists };
};

export const recordedTrackIds = async (): Promise<number[]> => {
  const { outcome } = await loadFixture(LIKED_TRACK_IDS);
  return (
    outcome.response.body as { playlist: { trackIds: { id: number }[] } }
  ).playlist.trackIds.map((track) => track.id);
};

type SyncStep = 'hearts' | 'playlists' | 'albums' | 'artists' | 'likedTracks';
interface SyncOptions {
  from?: SyncStep;
  through?: SyncStep;
  until?: Promise<void>;
  holds?: Partial<
    Record<SyncStep, { until: Promise<void>; when?: Record<string, unknown> }>
  >;
  playlists?: string;
  albums?: string;
}

export const listener = (
  world: World,
  { playlists = PLAYLISTS_WITHOUT_POEMS } = {},
) => {
  const sessionCalls = (since = 0) =>
    world.netease.calls
      .slice(since)
      .filter((call) => !LIBRARY_SYNC_MODULES.has(call.module));
  const sessionModules = () => sessionCalls().map((call) => call.module);

  const replyLibrary = async ({
    from = 'hearts',
    through = 'likedTracks',
    until,
    holds = {},
    playlists: list = playlists,
    albums = COLLECTED_ALBUMS,
  }: SyncOptions = {}): Promise<void> => {
    const steps: [SyncStep, string][] = [
      ['hearts', HEARTS],
      ['playlists', list],
      ['albums', albums],
      ['artists', COLLECTED_ARTISTS],
      ['likedTracks', LIKED_TRACK_IDS],
    ];
    const first = steps.findIndex(([step]) => step === from);
    const last = steps.findIndex(([step]) => step === through);
    for (const [step, fixture] of steps.slice(first, last + 1)) {
      await world.netease.reply(
        fixture,
        holds[step] ?? {
          until: step === through ? until : undefined,
        },
      );
    }
  };

  const replyLikedSongs = async (): Promise<void> => {
    for (const page of [1, 2, 3, 4, 5])
      await world.netease.reply(likedPage(page));
  };

  const replyPlaylists = async (
    recordings: readonly RecordedPlaylist[],
    { rejected, rejection }: { rejected?: string; rejection?: string } = {},
  ): Promise<void> => {
    for (const playlist of recordings) {
      await world.netease.reply(playlist.detail);
      for (const page of playlist.pages) {
        await world.netease.reply(
          page.fixture === rejected ? rejection! : page.fixture,
        );
      }
    }
  };

  const signInAtHearts = async (device: Device): Promise<Tab> => {
    const tab = await device.open();
    await replyLibrary({
      through: 'hearts',
      until: never(),
    });
    await signIn(world, tab.app);
    return tab;
  };

  const signInAtLikedTracks = async (
    device: Device,
    { albums = COLLECTED_ALBUMS, until = never() } = {},
  ): Promise<Tab> => {
    const tab = await device.open();
    await replyLibrary({ albums, until });
    await signIn(world, tab.app);
    await world.settle();
    return tab;
  };

  const signInWithLiked = async (device: Device): Promise<Tab> => {
    const tab = await device.open();
    await replyLibrary();
    await replyLikedSongs();
    await world.netease.reply(LIKED_TRACK_IDS, {
      until: never(),
    });
    await signIn(world, tab.app);
    await world.settle();
    if (!tab.app.state.library?.liked?.complete)
      throw new Error('我喜欢的音乐没同步完');
    return tab;
  };

  const signInSynced = async (device: Device): Promise<Tab> => {
    const tab = await device.open();
    await replyLibrary();
    await replyLikedSongs();
    const { outcome } = await loadFixture(playlists);
    const list = (outcome.response.body as { playlist: { id: number }[] })
      .playlist;
    const before = await recordedBatch('before');
    await replyPlaylists(
      list.flatMap(
        ({ id }) => before.playlists.find((item) => item.id === id) ?? [],
      ),
    );
    await signIn(world, tab.app);
    await world.settle();
    if (tab.app.state.library?.sync.status !== 'synced')
      throw new Error(
        `曲库没同步完：${JSON.stringify(tab.app.state.library?.sync)}`,
      );
    return tab;
  };

  const reopen = async (
    device: Device,
    tab?: Tab,
    options: Omit<SyncOptions, 'from'> = {},
  ): Promise<Tab> => {
    if (tab) {
      await world.settle();
      tab.close();
    }
    await world.netease.reply('login/user_account.vip.json');
    await replyLibrary({
      through: 'hearts',
      until: never(),
      ...options,
    });
    const opened = await device.open();
    return opened;
  };

  const dailySongs = async (app: App): Promise<readonly Song[]> => {
    await world.netease.reply(DAILY);
    await app.openDaily();
    const daily = app.state.daily;
    if (daily?.status !== 'shown')
      throw new Error(`每日推荐没显示：${JSON.stringify(daily)}`);
    return daily.songs;
  };

  const openJazz = async (
    app: App,
    { songsHeld }: { songsHeld: boolean },
  ): Promise<void> => {
    await world.netease.reply(JAZZ_DETAIL);
    await world.netease.reply(SOME_SONGS, {
      until: songsHeld ? never() : undefined,
    });
    const opening = app.openPlaylist(900000002);
    if (!songsHeld) await opening;
    await world.settle();
  };

  const downloadLiked = async (
    device: Device,
    app: App,
    { id, downloadUrl }: Downloadable,
    { album = ALBUM_MISSING } = {},
  ): Promise<Song> => {
    await world.clock.advance(1000);
    const song = likedSong(app, id);
    await serveDownload(device, song, downloadUrl);
    await world.netease.reply(downloadUrl);
    await world.netease.reply(DOWNLOAD_LYRICS);
    await world.netease.reply(album);
    app.download(song);
    await world.settle();
    if (!app.state.downloads.has(id))
      throw new Error(
        `《${song.name}》没下完：${JSON.stringify(app.state.downloads.tasks.get(id))}`,
      );
    return song;
  };

  return {
    replyLibrary,
    replyLikedSongs,
    replyPlaylists,
    signInAtHearts,
    signInAtLikedTracks,
    signInWithLiked,
    signInSynced,
    reopen,
    dailySongs,
    openJazz,
    downloadLiked,
    sessionCalls,
    sessionModules,
  };
};

export const storedLibrary = async (
  device: Device,
  key: string,
): Promise<unknown> =>
  (await device.stored()).library.find(([name]) => name === key)?.[1];

export const storedTrackIds = async (
  device: Device,
  playlistId: number,
): Promise<number[] | undefined> => {
  const tracks = (await device.stored()).tracks.find(
    ([id]) => id === playlistId,
  )?.[1] as { trackIds: number[] } | undefined;
  return tracks?.trackIds;
};

export const storedPlaylistIds = async (device: Device): Promise<number[]> => {
  const playlists = (await storedLibrary(device, 'playlists')) as Playlist[];
  return playlists.map((playlist) => playlist.id);
};

export const storedCheckIns = async (device: Device): Promise<unknown[]> => {
  const { checkIns = [] } = await device.stored();
  return checkIns.map(([, value]) => value);
};

export const checkIns = (device: Device): { songId: number; body: unknown }[] =>
  device.requests.flatMap((request) => {
    const match = /^\/api\/songs\/(\d+)\/check-in$/.exec(request.path);
    return match
      ? [
          {
            songId: Number(match[1]),
            body: request.body,
          },
        ]
      : [];
  });

export const playUrlRequests = (device: Device): string[] =>
  device.requests.flatMap((request) =>
    request.path.includes('/play-url') ? [request.path] : [],
  );

export const current = (app: App): number | null => {
  const { queue, current } = app.state.player;
  return current === null ? null : queue[current].song.id;
};

export const likedSong = (app: App, id: number): Song => {
  const song = app.state.library?.liked?.songs.find((each) => each.id === id);
  if (!song) throw new Error(`我喜欢的音乐里没有 ${id}`);
  return song;
};

export const queueIds = (app: App) =>
  app.state.player.queue.map((entry) => entry.song.id);

export const noticeEntry = (app: App): NoticeEntry | null =>
  app.state.notices.at(-1) ?? null;
export const noticeOf = (app: App): OperationNotice | null =>
  noticeEntry(app)?.notice ?? null;

export const isSync = (request: SentRequest) =>
  ['/api/albums', '/api/artists'].includes(request.path) ||
  ['/api/hearts', '/api/playlists', '/api/songs'].some((path) =>
    request.path.startsWith(path),
  );
export const syncRequests = (device: Device) => device.requests.filter(isSync);
export const songPages = (device: Device) =>
  syncRequests(device)
    .filter((request) => request.path === '/api/songs')
    .map((request) => (request.body as { ids: number[] }).ids);
export const trackIdRequests = (device: Device) =>
  syncRequests(device)
    .flatMap(
      (request) =>
        request.path.match(/^\/api\/playlists\/(\d+)\/track-ids$/)?.[1] ?? [],
    )
    .map(Number);

export const DOWNLOAD_COVER_BYTES = 41_000;

export const downloadCoverUrl = (coverUrl: string): string =>
  `${coverUrl.replace(/^https?:\/\/p\d+\.music\.126\.net\//, 'https://p1.music.126.net/').replace(/^http:/, 'https:')}?param=512y512`;

export const serveDownload = async (
  device: Device,
  song: Song,
  downloadUrl: string,
): Promise<void> => {
  const { data } = (await loadFixture(downloadUrl)).outcome.response.body as {
    data: { url: string; size: number };
  };
  device.files.put(data.url.replace(/^http:/, 'https:'), {
    bytes: data.size,
    type: 'audio/mpeg',
  });
  device.files.put(downloadCoverUrl(song.album.coverUrl!), {
    bytes: DOWNLOAD_COVER_BYTES,
    type: 'image/jpeg',
  });
};
