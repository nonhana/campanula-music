import { readFile } from 'node:fs/promises';

import type {
  ModuleCallConfig,
  NcmApiFailure,
  NcmApiResponse,
  NcmFailureInfo,
} from 'hana-music-api';

import { loadFixture } from '../fixtures.ts';
import { validateResponse } from '../sdk-contract.ts';
import { inputs, validateQuery } from '../sdk-input.ts';
import {
  AUDIO_PREFIX,
  audioWav,
  clearUploads,
  localize,
  UPLOAD_PATH,
  UPLOAD_PREFIX,
} from './assets.ts';
import { fixtureFailure } from './fixture-format.ts';
import { queryKey, recordedQuery } from './query-key.ts';
import { readFixture } from './read-fixture.ts';
import type { MockConfig, ScenarioName } from './scenarios.ts';
import { configOf, isScenarioName } from './scenarios.ts';
import { sdkModules } from './sdk-modules.ts';
import type { SeedName } from './seed.ts';
import { POEMS_PLAYLIST } from './seed.ts';
import type { MockResult } from './store.ts';
import { MockStore } from './store.ts';

export const MOCK_RUNTIME_MARKER = '__CAMPANULA_MOCK_RUNTIME__';

const INDEX_FILE = new URL(
  '../../fixtures/netease/index.json',
  import.meta.url,
);
const SESSION_MODULES = new Set([
  'user_account',
  'user_detail',
  'vip_info',
  'vip_info_v2',
  'login_refresh',
  'login_cellphone',
  'login_qr_key',
  'login_qr_create',
  'login_qr_check',
  'captcha_sent',
  'logout',
  'login_status',
]);
const DEVICE_ID = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const CREDENTIALS = { MUSIC_U: 'mock-music-u', __csrf: 'mock-csrf' };
const cookieFor = (musicU = 'mock-music-u'): string[] => [
  `MUSIC_U=${musicU}; Path=/; Max-Age=15552000`,
  '__csrf=mock-csrf; Path=/',
];

const sdkFailure = (
  status: number,
  body: unknown,
  failure?: NcmFailureInfo,
): NcmApiFailure<unknown> => ({
  status,
  body,
  cookie: [],
  failure: failure ?? fixtureFailure(body),
  ...(failure?.kind === 'rateLimited'
    ? { retryAfter: failure.retryAfter }
    : {}),
});

interface IndexEntry {
  path: string;
  module: string;
  queryKey: string;
  query: unknown;
  outcome: string;
  validated: boolean;
}

const choose = (entries: IndexEntry[]): IndexEntry | null =>
  entries.find((entry) => entry.validated && entry.outcome === 'ok') ??
  entries.find((entry) => entry.validated) ??
  null;

interface Index {
  recordings: number;
  modules: Record<string, { count: number }>;
  entries: IndexEntry[];
}

let indexPromise: Promise<Index> | null = null;
const fixtureCache = new Map<
  string,
  Promise<{
    rejected: boolean;
    status: number;
    body: unknown;
    failure?: NcmFailureInfo;
  }>
>();
interface RuntimeState {
  config: MockConfig;
  store: MockStore;
  calls: { module: string; query: unknown }[];
  misses: { module: string; query: unknown; scenario: string }[];
  songDetailCalls: number;
  qrChecks: number;
  tracksInitial: boolean;
  templates: { module: string; source: string }[];
  lastCoverImgId: string;
}

// 控制接口和 SDK 经同一个 SSR runner 导入，状态只属于这个模块实例。
const state: RuntimeState = {
  config: configOf('default'),
  store: new MockStore('small'),
  calls: [],
  misses: [],
  songDetailCalls: 0,
  qrChecks: 0,
  tracksInitial: false,
  templates: [],
  lastCoverImgId: 'mock-cover',
};

const index = async (): Promise<Index> => {
  indexPromise ??= readFile(INDEX_FILE, 'utf8').then(
    (text) => JSON.parse(text) as Index,
  );
  return indexPromise;
};

const fixture = async (
  entry: IndexEntry,
): Promise<{
  rejected: boolean;
  status: number;
  body: unknown;
  failure?: NcmFailureInfo;
}> => {
  let loaded = fixtureCache.get(entry.path);
  if (!loaded) {
    loaded = loadFixture(entry.path).then(({ outcome }) => ({
      rejected: outcome.rejected,
      ...outcome.response,
    }));
    fixtureCache.set(entry.path, loaded);
  }
  return loaded;
};

const miss = (module: string, query: unknown): never => {
  state.misses.push({ module, query, scenario: state.config.name });
  console.error(
    `Mock 未覆盖：模块 ${module}，查询 ${JSON.stringify(query)}，场景 ${state.config.name}。看 GET /api/mock/coverage 补录制`,
  );
  throw sdkFailure(
    500,
    { code: 500, msg: `Mock 未覆盖：${module}` },
    { kind: 'unknown' },
  );
};

const entryFor = async (
  module: string,
  query: unknown,
): Promise<IndexEntry | null> => {
  const current = await index();
  const key = queryKey(query, module);
  const candidates = current.entries.filter(
    (entry) => entry.module === module && entry.queryKey === key,
  );
  if (candidates.length > 0) return choose(candidates);
  if (module === 'cloudsearch') {
    const wanted = query as {
      keywords?: unknown;
      type?: unknown;
      offset?: unknown;
      limit?: unknown;
    };
    const pick = current.entries
      .filter((entry) => entry.module === module && entry.validated)
      .map((entry) => ({
        entry,
        query: entry.query as {
          keywords?: unknown;
          type?: unknown;
          offset?: unknown;
          limit?: unknown;
        },
      }))
      .filter(
        ({ query: item }) =>
          item.keywords === wanted.keywords &&
          item.type === wanted.type &&
          Number(item.offset ?? 0) === Number(wanted.offset ?? 0) &&
          Number(item.limit ?? 0) >= Number(wanted.limit ?? 0),
      )
      .sort((a, b) => Number(a.query.limit) - Number(b.query.limit));
    if (pick[0]) return pick[0].entry;
  }
  if (module === 'search_suggest') {
    const keywords =
      typeof query === 'object' && query !== null
        ? String((query as Record<string, unknown>).keywords ?? '')
        : '';
    const suggestions = current.entries
      .filter((entry) => entry.module === module && entry.validated)
      .map((entry) => ({
        entry,
        words: String((entry.query as { keywords?: unknown }).keywords ?? ''),
      }))
      .filter(({ words }) => words.startsWith(keywords))
      .sort((a, b) => a.words.length - b.words.length);
    if (suggestions[0]) return suggestions[0].entry;
  }
  return null;
};

const fallback = async (
  module: string,
  query: unknown,
  { generic = false } = {},
): Promise<unknown> => {
  const entry =
    (await entryFor(module, query)) ??
    (generic
      ? choose((await index()).entries.filter((item) => item.module === module))
      : null);
  if (!entry) return miss(module, query);
  state.templates.push({ module, source: entry.path });
  const loaded = await fixture(entry);
  if (loaded.rejected)
    throw sdkFailure(loaded.status, loaded.body, loaded.failure);
  return localize(loaded.body);
};

const clone = <T>(value: T): T => structuredClone(value);

const write = (
  result: MockResult,
): { status: number; body: unknown; cookie: string[] } => {
  if (!result.ok) throw sdkFailure(result.status, result.body);
  return {
    status: 200,
    body: localize(result.body),
    cookie: [],
  };
};

const num = (value: unknown): number =>
  typeof value === 'number' ? value : Number(value);

const str = (value: unknown): string =>
  typeof value === 'string' ? value : String(value ?? '');

const idsOf = (value: unknown): number[] => {
  if (Array.isArray(value)) return value.map(num);
  return str(value).split(',').filter(Boolean).map(Number);
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const configure = async (
  input:
    | ScenarioName
    | (Partial<MockConfig> & { name?: ScenarioName }) = 'default',
): Promise<void> => {
  const name = typeof input === 'string' ? input : (input.name ?? 'default');
  if (!isScenarioName(name))
    throw new Error(`不认识的 mock 场景：${String(name)}`);
  const base = configOf(name);
  state.config = {
    ...base,
    ...(typeof input === 'string' ? {} : input),
  };
  state.calls = [];
  state.misses = [];
  state.songDetailCalls = 0;
  state.qrChecks = 0;
  state.tracksInitial = false;
  state.templates = [];
  clearUploads();
  await state.store.reset(state.config.seed);
  if (state.config.deletedPlaylist)
    await state.store.deletePlaylist(POEMS_PLAYLIST);
  if (state.config.emptyPlaylist)
    await state.store.clearPlaylist(POEMS_PLAYLIST);
};

export const reset = async (): Promise<void> => {
  await configure('default');
};

export const loginCredentials = (): {
  deviceId: string;
  credentials: Record<string, string>;
} => ({
  deviceId: DEVICE_ID,
  credentials: { ...CREDENTIALS },
});

export const status = (): {
  enabled: true;
  scenario: ScenarioName;
  seed: SeedName;
  offline: boolean;
} => ({
  enabled: true,
  scenario: state.config.name,
  seed: state.config.seed,
  offline: state.config.offline,
});

export const coverage = async (): Promise<Record<string, unknown>> => {
  const current = await index();
  const used = [...new Set(state.calls.map((call) => call.module))].sort();
  return {
    scenario: state.config.name,
    seed: state.config.seed,
    calls: state.calls.length,
    usedModules: used,
    misses: state.misses,
    templates: state.templates,
    index: {
      recordings: current.recordings,
      modules: Object.keys(current.modules).sort(),
    },
  };
};

const hasCredentials = (callConfig: ModuleCallConfig): boolean => {
  const cookie = callConfig.cookie;
  return typeof cookie === 'object' && cookie !== null
    ? Boolean(cookie.MUSIC_U)
    : Boolean(cookie);
};

const respond = async (
  module: string,
  query: Record<string, unknown> = {},
  callConfig: ModuleCallConfig = {},
): Promise<NcmApiResponse<unknown>> => {
  state.calls.push({ module, query });
  query = recordedQuery(module, query);
  if (state.config.latencyMs > 0) await sleep(state.config.latencyMs);
  if (state.config.offline)
    throw sdkFailure(
      503,
      { code: 503, msg: 'Mock 断网' },
      { kind: 'transport' },
    );
  if (state.config.rateLimited && !SESSION_MODULES.has(module))
    throw sdkFailure(
      405,
      {
        code: 405,
        msg: '操作过于频繁，请稍后再试',
        retryAfter: 30,
      },
      { kind: 'rateLimited', code: 405, retryAfter: 30 },
    );

  const data = await state.store.load();
  const templates = data.templates as Record<string, unknown>;

  switch (module) {
    case 'user_account':
      return {
        status: 200,
        body: localize(
          state.config.loginExpired
            ? templates.accountInvalid
            : hasCredentials(callConfig)
              ? templates.account
              : templates.accountAnonymous,
        ),
        cookie: [],
      };
    case 'login_cellphone':
      if (state.config.loginExpired)
        throw sdkFailure(301, { code: 301, msg: '需要登录' });
      return {
        status: 200,
        body: localize(templates.loginCellphone),
        cookie: cookieFor(),
      };
    case 'login_qr_check':
      if (
        state.config.name === 'qr-confirm' ||
        state.config.name === 'qr-expired'
      ) {
        const step = state.qrChecks++;
        const path =
          step === 0
            ? 'login/login_qr_check.801-waiting.json'
            : step === 1 && state.config.name === 'qr-confirm'
              ? 'login/login_qr_check.802-scanned.json'
              : state.config.name === 'qr-expired'
                ? 'login/login_qr_check.800-expired.json'
                : 'login/login_qr_check.803-success.json';
        const raw = await readFixture(path);
        return {
          status: 200,
          body: raw.response.body,
          cookie: path.includes('803') ? cookieFor() : [],
        };
      }
      if (state.config.loginExpired)
        throw sdkFailure(301, { code: 301, msg: '需要登录' });
      return {
        status: 200,
        body: localize(templates.qrSuccess),
        cookie: cookieFor(),
      };
    case 'login_qr_key':
    case 'login_qr_create':
    case 'captcha_sent':
    case 'login_status':
    case 'verify_getQr':
      return {
        status: 200,
        body: localize(await fallback(module, query, { generic: true })),
        cookie: [],
      };
    case 'login_refresh':
      if (state.config.loginExpired || !hasCredentials(callConfig))
        throw sdkFailure(301, { code: 301, msg: '需要登录' });
      return {
        status: 200,
        body: localize(templates.loginRefresh),
        cookie: cookieFor(`mock-music-u-${Date.now()}`),
      };
    case 'logout':
      return {
        status: 200,
        body: localize(await fallback(module, query, { generic: true })),
        cookie: [],
      };
    case 'likelist':
      if (state.config.loginExpired)
        throw sdkFailure(301, { code: 301, msg: '需要登录' });
      return {
        status: 200,
        body: localize(await state.store.likelist()),
        cookie: [],
      };
    case 'user_playlist': {
      const body = await state.store.userPlaylist(
        num(query.offset ?? 0),
        num(query.limit ?? 1000),
      );
      if (state.config.loginExpired) {
        const list = (body.playlist as Record<string, unknown>[]).map(
          (item) => ({ ...item, subscribed: null }),
        );
        return {
          status: 200,
          body: localize({ ...body, playlist: list }),
          cookie: [],
        };
      }
      return {
        status: 200,
        body: localize(body),
        cookie: [],
      };
    }
    case 'playlist_detail': {
      const detail = await state.store.playlistDetail(num(query.id));
      return {
        status: 200,
        body: localize(
          detail ??
            (data.seed === 'small'
              ? miss(module, query)
              : await fallback(module, query)),
        ),
        cookie: [],
      };
    }
    case 'song_detail': {
      state.songDetailCalls += 1;
      if (state.config.partialSync && state.songDetailCalls >= 2) {
        const failed = await fixture(
          (await index()).entries.find(
            (entry) =>
              entry.path ===
              'library/song_detail.liked-page4.502-null-artist.json.gz',
          )!,
        );
        throw sdkFailure(failed.status, failed.body, failed.failure);
      }
      const body = await state.store.songDetail(idsOf(query.ids));
      return {
        status: 200,
        body: localize(body ?? (await fallback(module, query))),
        cookie: [],
      };
    }
    case 'album_sublist':
      return {
        status: 200,
        body: localize(
          await state.store.albumSublist(
            num(query.offset ?? 0),
            num(query.limit ?? 1000),
          ),
        ),
        cookie: [],
      };
    case 'artist_sublist':
      return {
        status: 200,
        body: localize(
          await state.store.artistSublist(
            num(query.offset ?? 0),
            num(query.limit ?? 1000),
          ),
        ),
        cookie: [],
      };
    case 'song_url_v1': {
      const id = num(query.id);
      const part = await state.store.songPart(id);
      if (!part) {
        if (data.seed === 'small') return miss(module, query);
        return {
          status: 200,
          body: localize(await fallback(module, query)),
          cookie: [],
        };
      }
      if (part.privilege.st < 0) {
        return {
          status: 200,
          body: localize(clone(templates.songUrlNoCopyright)),
          cookie: [],
        };
      }
      const body = clone(templates.songUrl) as {
        data: Record<string, unknown>[];
      };
      Object.assign(body.data[0]!, {
        id,
        url: `${AUDIO_PREFIX}/${id}.wav`,
        size: 32000,
        time: 2000,
        br: 128000,
        md5: `mock-${id}`,
        code: 200,
        fee: 0,
        payed: 0,
        level: 'exhigh',
        type: 'mp3',
        freeTrialInfo: null,
        expi: 1200,
        urlSource: 0,
      });
      return {
        status: 200,
        body: localize(body),
        cookie: [],
      };
    }
    case 'song_download_url_v1': {
      // size 要用 audioWav 的字节数：浏览器下完会核对
      const id = num(query.id);
      const part = await state.store.songPart(id);
      if (!part) {
        if (data.seed === 'small') return miss(module, query);
        return {
          status: 200,
          body: localize(await fallback(module, query)),
          cookie: [],
        };
      }
      const body = clone(
        part.privilege.st < 0
          ? templates.songDownloadUrlNoCopyright
          : templates.songDownloadUrl,
      ) as { data: Record<string, unknown> };
      if (part.privilege.st < 0) {
        Object.assign(body.data, { id });
      } else {
        Object.assign(body.data, {
          id,
          url: `${AUDIO_PREFIX}/${id}.wav`,
          size: audioWav(id).length,
          md5: `mock-${id}`,
          type: 'wav',
          level: 'exhigh',
          encodeType: 'wav',
          expi: 1200,
        });
      }
      return {
        status: 200,
        body: localize(body),
        cookie: [],
      };
    }
    case 'image_upload_token': {
      const imgId = String(Date.now() + state.calls.length);
      state.lastCoverImgId = imgId;
      const body = clone(templates.imageUploadToken) as {
        data: Record<string, unknown>;
      };
      Object.assign(body.data, {
        imgId,
        token: 'mock-upload-token',
        uploadUrl: `${UPLOAD_PATH}/${imgId}`,
        url_pre: `${UPLOAD_PREFIX}/${imgId}`,
      });
      return {
        status: 200,
        body: localize(body),
        cookie: [],
      };
    }
    case 'playlist_cover_update': {
      const imgId = str(query.imgId ?? state.lastCoverImgId);
      return write(
        await state.store.setCover(num(query.id), `${UPLOAD_PREFIX}/${imgId}`),
      );
    }
    case 'playlist_create': {
      return write(
        await state.store.createPlaylist(str(query.name), num(query.privacy)),
      );
    }
    case 'playlist_delete': {
      return write(await state.store.deletePlaylist(num(query.id)));
    }
    case 'playlist_name_update': {
      return write(
        await state.store.renamePlaylist(num(query.id), str(query.name)),
      );
    }
    case 'playlist_desc_update': {
      return write(
        await state.store.describePlaylist(num(query.id), str(query.desc)),
      );
    }
    case 'playlist_tags_update': {
      return write(
        await state.store.tagPlaylist(
          num(query.id),
          str(query.tags).split(';').filter(Boolean),
        ),
      );
    }
    case 'playlist_privacy': {
      return write(await state.store.publishPlaylist(num(query.id)));
    }
    case 'playlist_order_update': {
      return write(
        await state.store.orderPlaylists(
          JSON.parse(str(query.ids)) as number[],
        ),
      );
    }
    case 'playlist_tracks':
      if (state.config.name === 'tracks-512') {
        if (query.step === 'initial') {
          state.tracksInitial = true;
          throw sdkFailure(512, { code: 512, message: '合成首次拒绝' });
        }
        if (query.step !== 'fallback' || !state.tracksInitial)
          return miss(module, query);
        state.tracksInitial = false;
      }
      return write(
        await (str(query.op) === 'add'
          ? state.store.addTracks(num(query.pid), idsOf(query.tracks))
          : state.store.removeTracks(num(query.pid), idsOf(query.tracks))),
      );
    case 'song_order_update': {
      return write(
        await state.store.orderTracks(
          num(query.pid),
          JSON.parse(str(query.ids)) as number[],
        ),
      );
    }
    case 'like': {
      return write(await state.store.heart(num(query.id), Boolean(query.like)));
    }
    case 'album_sub': {
      return write(
        await state.store.collectAlbum(num(query.id), num(query.t) === 1),
      );
    }
    case 'artist_sub': {
      return write(
        await state.store.collectArtist(num(query.id), num(query.t) === 1),
      );
    }
    case 'playlist_subscribe': {
      const id = num(query.id);
      const collected = num(query.t) === 1;
      if (collected && !(await state.store.playlistDetail(id))) {
        if (data.seed === 'small') return miss(module, query);
        const body = (await fallback('playlist_detail', { id })) as Parameters<
          typeof state.store.adoptPlaylist
        >[0];
        await state.store.adoptPlaylist(body);
      }
      return write(await state.store.subscribePlaylist(id, collected));
    }
    case 'scrobble':
      return {
        status: 200,
        body: localize(templates.scrobble),
        cookie: [],
      };
    case 'recommend_songs':
      if (data.seed === 'small')
        return {
          status: 200,
          body: localize({
            ...(templates.recommendSongs as Record<string, unknown>),
            data: {
              ...(templates.recommendSongs as { data: object }).data,
              dailySongs: [...data.songs.values()].map(
                ({ song, privilege }) => ({ ...song, privilege }),
              ),
            },
          }),
          cookie: [],
        };
      return {
        status: 200,
        body: localize(templates.recommendSongs),
        cookie: [],
      };
    case 'playlist_catlist':
      return {
        status: 200,
        body: localize(templates.playlistCatlist),
        cookie: [],
      };
    case 'album':
    case 'artist_album':
    case 'artist_songs':
    case 'artist_desc':
    case 'cloudsearch':
    case 'search_suggest':
      if (data.seed === 'small') {
        const songs = [...data.songs.values()].map(({ song, privilege }) => ({
          ...song,
          privilege,
        }));
        if (
          module === 'album' &&
          num(query.id) === 3149073 &&
          state.config.name !== 'missing-relation'
        ) {
          const body = (
            await readFixture('library/album-artist/008-album.json.gz')
          ).response.body as Record<string, unknown>;
          return {
            status: 200,
            body: localize({
              ...body,
              album: { ...data.albumDetails.get(3149073), size: songs.length },
              songs,
            }),
            cookie: [],
          };
        }
        if (module === 'artist_songs' && num(query.id) === 33927412)
          return {
            status: 200,
            body: localize({
              code: 200,
              songs: songs.slice(
                num(query.offset ?? 0),
                num(query.offset ?? 0) + num(query.limit ?? 100),
              ),
              more: false,
              total: songs.length,
            }),
            cookie: [],
          };
        if (module === 'artist_album' && num(query.id) === 33927412) {
          const body = (
            await readFixture('library/album-artist/004-artist_album.json.gz')
          ).response.body as Record<string, unknown>;
          return {
            status: 200,
            body: localize({
              ...body,
              artist: {
                ...(body.artist as Record<string, unknown>),
                ...data.artists[0],
              },
              hotAlbums: [data.albumDetails.get(3149073)],
              more: false,
            }),
            cookie: [],
          };
        }
        if (module === 'artist_desc' && num(query.id) === 33927412)
          return {
            status: 200,
            body: await fallback(module, query),
            cookie: [],
          };
        if (module === 'cloudsearch') {
          const matches =
            state.config.name === 'empty-search'
              ? []
              : songs.filter((song) => song.name.includes(str(query.keywords)));
          const type = num(query.type);
          const [key, count, found] =
            type === 1
              ? (['songs', 'songCount', matches] as const)
              : type === 10
                ? (['albums', 'albumCount', data.albums] as const)
                : type === 100
                  ? (['artists', 'artistCount', data.artists] as const)
                  : (['playlists', 'playlistCount', data.playlists] as const);
          const values = state.config.name === 'empty-search' ? [] : found;
          return {
            status: 200,
            body: localize({
              code: 200,
              result: {
                [key]: values.slice(
                  num(query.offset ?? 0),
                  num(query.offset ?? 0) + num(query.limit ?? 30),
                ),
                [count]: values.length,
              },
            }),
            cookie: [],
          };
        }
        if (module === 'search_suggest')
          return { status: 200, body: { code: 200, result: {} }, cookie: [] };
        return miss(module, query);
      }
      return { status: 200, body: await fallback(module, query), cookie: [] };
    case 'user_detail':
    case 'vip_info':
    case 'vip_info_v2':
    case 'user_record':
    case 'playlist_track_all':
    case 'artist_detail':
      return { status: 200, body: await fallback(module, query), cookie: [] };
    case 'lyric_new': {
      const entry = await entryFor(module, query);
      return {
        status: 200,
        body: entry ? await fallback(module, query) : templates.lyric,
        cookie: [],
      };
    }
    default:
      return miss(module, query);
  }
};

export const invokeModule = async (
  module: string,
  query: Record<string, unknown> = {},
  config: ModuleCallConfig = {},
): Promise<NcmApiResponse<unknown>> => {
  try {
    if (inputs[module]) validateQuery(module, query, state.config.name);
    const result = await respond(module, query, config);
    await validateResponse(module, result, false, state.config.name, query);
    return result;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'failure' in error) {
      await validateResponse(
        module,
        error as NcmApiFailure<unknown>,
        true,
        state.config.name,
      );
    }
    throw error;
  }
};

export * as assets from './assets.ts';

export const {
  album,
  albumSub,
  albumSublist,
  artistAlbum,
  artistDesc,
  artistSongs,
  artistSub,
  artistSublist,
  captchaSent,
  cloudsearch,
  imageUploadToken,
  like,
  likelist,
  loginCellphone,
  loginQrCheck,
  loginQrCreate,
  loginQrKey,
  loginRefresh,
  logout,
  lyricNew,
  playlistCatlist,
  playlistCoverUpdate,
  playlistCreate,
  playlistDelete,
  playlistDescUpdate,
  playlistDetail,
  playlistNameUpdate,
  playlistOrderUpdate,
  playlistPrivacy,
  playlistSubscribe,
  playlistTagsUpdate,
  playlistTracks,
  recommendSongs,
  scrobble,
  searchSuggest,
  songDetail,
  songDownloadUrlV1,
  songOrderUpdate,
  songUrlV1,
  userAccount,
  userPlaylist,
  verifyGetQr,
} = sdkModules(invokeModule);

export {
  generateDeviceId,
  getNcmFailureInfo,
  isNcmApiResponse,
} from 'hana-music-api';
