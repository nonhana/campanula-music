import type { Account } from '#lib/api/account.ts';
import type { Playlist, Song } from '#lib/api/library.ts';
import type { LyricsResponse } from '#lib/api/playback.ts';
import type { LocalDatabase } from '#lib/app/local.ts';
import { createLocalDb, PLAYER } from '#lib/app/local.ts';

export const songs: Song[] = [
  ['Window Light', '窗边的光', 'window'],
  ['Tidal Steps', '潮汐的脚步', 'tide'],
  ['After the Rain', '雨停以后', 'rain'],
].map(([name, translation, file], i) => ({
  id: 101 + i,
  name,
  translations: [translation],
  aliases: [],
  artists: [{ id: 301, name: 'Campanula 演示音频' }],
  album: { id: 201 + i, name: translation, coverUrl: `/media/${file}.svg` },
  duration: 24000,
  downloadSize: null,
  availability: 'full',
  trackNumber: 1,
  disc: '1',
  publishedAt: null,
}));
export const account: Account = {
  id: 7001,
  nickname: '示例听众',
  avatarUrl: null,
};
const lists: Pick<Playlist, 'id' | 'name' | 'kind'>[] = [
  { id: 501, name: '我喜欢的音乐', kind: 'liked' },
  { id: 502, name: '窗边、海边、雨后', kind: 'collected' },
];
export const playlists: Playlist[] = lists.map((playlist) => ({
  ...playlist,
  private: false,
  coverUrl: '/media/window.svg',
  creator: 'Campanula',
  creatorAvatarUrl: null,
  playCount: null,
  description: '三段原创合成音频，用来试播放、歌词和切歌。',
  tags: [],
  trackCount: songs.length,
  tracksUpdatedAt: 1,
}));
const verses = [
  [
    ['Light falls across the window', '光落在窗边'],
    ['A little bell wakes in the breeze', '小铃在风里醒来'],
    ['We let the morning move slowly', '让清晨慢一点走'],
    ['And leave a little room to breathe', '留一点空隙，听风经过'],
  ],
  [
    ['Footsteps follow the water', '脚步跟着海水'],
    ['The tide draws a line in the sand', '潮汐在沙上画线'],
    ['One small wave after another', '一朵浪花接着一朵'],
    ['We pause where the sea meets the land', '在海与岸之间停一会儿'],
  ],
  [
    ['Rain slips away from the rooftops', '雨从屋檐上滑落'],
    ['The street holds a piece of the sky', '街道留住一小片天'],
    ['We fold up the last of our umbrellas', '收起最后一把伞'],
    ['And watch a small cloud wander by', '看一朵小云慢慢经过'],
  ],
];
const lyrics = (index: number): LyricsResponse => ({
  kind: 'word',
  translated: true,
  romanized: false,
  yrc: null,
  romalrc: null,
  lines: verses[index].map(([text, translation], i) => ({
    start: i * 6,
    text,
    translation,
    romanization: null,
    words: text.split(' ').map((word, j, words) => ({
      text: word + (j < words.length - 1 ? ' ' : ''),
      start: i * 6 + (j * 5) / words.length,
      end: i * 6 + ((j + 1) * 5) / words.length,
    })),
  })),
});
const send = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const sampleFetch = async (
  path: string,
  init?: RequestInit,
): Promise<Response> => {
  const url = new URL(path, location.origin);
  if (url.origin !== location.origin) throw new TypeError('示例只读取本站素材');
  const method = init?.method?.toUpperCase() ?? 'GET';
  const key = url.pathname;
  if (method === 'GET') {
    if (key === '/demo/api/account') return send({ account });
    if (key === '/demo/api/hearts')
      return send({ songIds: songs.map((song) => song.id) });
    if (key === '/demo/api/playlists') return send({ playlists });
    if (key === '/demo/api/albums') return send({ albums: [] });
    if (key === '/demo/api/artists') return send({ artists: [] });
    const list = /^\/demo\/api\/playlists\/(501|502)(\/track-ids)?$/.exec(key);
    if (list) {
      const trackIds = songs.map((song) => song.id);
      return send(
        list[2]
          ? { trackIds }
          : {
              kind: 'shown',
              playlist: playlists.find((p) => p.id === Number(list[1])),
              trackIds,
              tracksUpdatedAt: 1,
            },
      );
    }
    const track = /^\/demo\/api\/songs\/(101|102|103)\/(play-url|lyrics)$/.exec(
      key,
    );
    if (track) {
      const index = Number(track[1]) - 101;
      return send(
        track[2] === 'lyrics'
          ? lyrics(index)
          : {
              playable: true,
              url: new URL(
                `/media/${['window', 'tide', 'rain'][index]}.mp3`,
                location.origin,
              ).href,
              trial: false,
              expiresIn: 3600,
            },
      );
    }
  }
  if (method === 'POST' && key === '/demo/api/songs') {
    const body: { ids: number[] } = JSON.parse(String(init?.body));
    return send({ songs: songs.filter((song) => body.ids.includes(song.id)) });
  }
  // 收听记录只在这个示例里确认，不发送、不保存到真实账号。
  if (
    method === 'POST' &&
    /^\/demo\/api\/songs\/(?:101|102|103)\/check-in$/.test(key)
  )
    return send({ kind: 'done' });
  return send({ error: { kind: 'notFound' } }, 404);
};

export const prepareSample = async (db: LocalDatabase) => {
  const local = createLocalDb(db);
  await local.resetLibrary(account.id);
  await local.saveLibrary(account.id, {
    hearts: songs.map((song) => song.id),
    playlists,
    songs,
    tracks: new Map(
      playlists.map((playlist) => [
        playlist.id,
        { version: 1, trackIds: songs.map((song) => song.id), complete: true },
      ]),
    ),
    albums: [],
    artists: [],
    firstSyncDone: true,
  });
  await db.write([PLAYER], (tx) => {
    const store = tx.objectStore(PLAYER);
    store.put(
      {
        owner: account.id,
        entries: songs.map((song) => ({
          song,
          source: { kind: 'playlist', id: 502 },
        })),
        mode: 'loop',
        order: null,
        upNext: [],
        filling: null,
      },
      'queue',
    );
    store.put(
      {
        owner: account.id,
        songId: 101,
        position: 0,
        duration: 24,
        trial: false,
        listened: 0,
      },
      'progress',
    );
  });
};
