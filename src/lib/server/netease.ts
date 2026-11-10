import { NETEASE_REAL_IP } from '$app/env/private';
import type {
  ModuleCallConfig,
  ModuleIdentifier,
  ModuleQueryOf,
  ModuleResponseOf,
  PlaylistSummary,
} from 'hana-music-api';
import { invokeModule } from 'hana-music-api';

import type { Account } from '#lib/api/account.js';
import type { CoverTokenResponse, SetCoverResponse } from '#lib/api/cover.js';
import type { DailyResponse } from '#lib/api/discover.js';
import type { NeteaseFailure } from '#lib/api/errors.js';
import type {
  AlbumResponse,
  ArtistAlbum,
  ArtistAlbumsResponse,
  ArtistIntroResponse,
  ArtistResponse,
  ArtistSongOrder,
  ArtistSongsResponse,
  Availability,
  CollectedAlbum,
  CollectedArtist,
  Credit,
  Playlist,
  PlaylistCollectRequest,
  PlaylistInfo,
  PlaylistPageResponse,
  PlaylistTagGroup,
  PlaylistUnavailable,
  Song,
} from '#lib/api/library.js';
import {
  ARTIST_ALBUMS_PER_REQUEST,
  ARTIST_SONGS_PER_REQUEST,
  playlistKindOf,
} from '#lib/api/library.js';
import type { QrResponse } from '#lib/api/login.js';
import type {
  DownloadUrlResponse,
  LyricsResponse,
  PlaySource,
  PlayUrlResponse,
  Quality,
} from '#lib/api/playback.js';
import type {
  SearchKind,
  SearchPageResponse,
  SuggestionsResponse,
} from '#lib/api/search.js';
import { SEARCH_RESULTS_PER_REQUEST } from '#lib/api/search.js';
import type { WriteResponse } from '#lib/api/write.js';

import { lyricsOf } from './lyrics';
import { NeteaseError } from './netease-error';

export interface Listener {
  deviceId: string;
  credentials: Record<string, string> | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const translate = (
  thrown: unknown,
): { failure: NeteaseFailure; body: unknown } => {
  if (
    !isRecord(thrown) ||
    typeof thrown.status !== 'number' ||
    !('body' in thrown)
  )
    throw thrown; // 不是 SDK 的失败返回，是 Campanula 自己的缺陷
  const { status, body } = thrown;
  const fields = isRecord(body) ? body : {};
  const code = typeof fields.code === 'number' ? fields.code : status;
  if (code === 301) {
    return {
      failure: { kind: 'needsLogin' },
      body,
    };
  }
  if (typeof fields.retryAfter === 'number') {
    return {
      failure: { kind: 'rateLimited', retryAfter: fields.retryAfter },
      body,
    };
  }
  if (isRecord(fields.upstreamShape)) {
    return {
      failure: { kind: 'upstreamChanged' },
      body,
    };
  }
  if (
    status >= 500 &&
    Object.keys(fields).every((key) => key === 'code' || key === 'msg')
  ) {
    return {
      failure: { kind: 'neteaseUnavailable' },
      body,
    };
  }
  const message =
    typeof fields.message === 'string'
      ? fields.message
      : typeof fields.msg === 'string'
        ? fields.msg
        : '';
  return {
    failure: { kind: 'rejected', code, message },
    body,
  };
};

const call = async <K extends ModuleIdentifier>(
  module: K,
  query: ModuleQueryOf<K>,
  listener: Listener,
  checkToken?: string,
): Promise<ModuleResponseOf<K>> => {
  const config: ModuleCallConfig = {
    cookie: listener.credentials ?? undefined,
    state: { deviceId: listener.deviceId },
    realIP: NETEASE_REAL_IP || undefined,
    ...(checkToken === undefined ? {} : { checkToken }),
  };
  try {
    return await invokeModule(module, query, config);
  } catch (thrown) {
    const { failure, body } = translate(thrown);
    const error = new NeteaseError(failure, body);
    console.warn(`网易云 ${module} 失败：${error.message}`);
    throw error;
  }
};

const credentialsFrom = (
  module: ModuleIdentifier,
  setCookies: readonly string[],
  base: Record<string, string> = {},
): Record<string, string> => {
  const credentials: Record<string, string> = { ...base };
  for (const line of setCookies) {
    const [pair = '', ...attributes] = line.split(';');
    const at = pair.indexOf('=');
    if (at <= 0) continue;
    const name = pair.slice(0, at).trim();
    const value = pair.slice(at + 1).trim();
    const expired = attributes.some((attribute) =>
      /^\s*max-age\s*=\s*(?:0|-\d+)\s*$/i.test(attribute),
    );
    if (value && !expired) credentials[name] = value;
    else delete credentials[name];
  }
  if (!credentials.MUSIC_U || credentials.MUSIC_U === base.MUSIC_U)
    throw shapeChanged(module, '没有下发新的 MUSIC_U');
  return credentials;
};

const shapeChanged = (
  module: ModuleIdentifier,
  detail: string,
): NeteaseError => {
  const error = new NeteaseError({ kind: 'upstreamChanged' }, null);
  console.warn(`网易云 ${module} 失败：${error.message}（${detail}）`);
  return error;
};

export const createLoginQr = async (
  listener: Listener,
): Promise<QrResponse> => {
  const {
    body: {
      data: { unikey: key },
    },
  } = await call('login_qr_key', {}, listener);
  const { body } = await call(
    'login_qr_create',
    { key, qrimg: true },
    listener,
  );
  return { key, image: body.data.qrimg };
};

export type QrCheck =
  | { status: 'waiting' }
  | { status: 'scanned'; nickname: string | null; avatarUrl: string | null }
  | { status: 'expired' }
  | { status: 'needsVerification'; image: string }
  | { status: 'confirmed'; credentials: Record<string, string> };

const verificationOf = (
  body: unknown,
): {
  vid: string;
  type: string;
  token: string;
  evid: string;
  sign: string;
} | null => {
  const data = isRecord(body) && isRecord(body.data) ? body.data : null;
  if (!data) return null;
  let params: unknown = data.params;
  if (typeof params === 'string') {
    try {
      params = JSON.parse(params);
    } catch {
      return null;
    }
  }
  const { verifyId, verifyType, verifyToken } = data;
  const isId = (value: unknown) =>
    typeof value === 'string' || typeof value === 'number';
  if (
    !isId(verifyId) ||
    !isId(verifyType) ||
    typeof verifyToken !== 'string' ||
    !verifyToken ||
    !isRecord(params) ||
    typeof params.event_id !== 'string' ||
    typeof params.sign !== 'string'
  ) {
    return null;
  }
  return {
    vid: String(verifyId),
    type: String(verifyType),
    token: verifyToken,
    evid: params.event_id,
    sign: params.sign,
  };
};

export const checkLoginQr = async (
  key: string,
  listener: Listener,
): Promise<QrCheck> => {
  let response: ModuleResponseOf<'login_qr_check'>;
  try {
    response = await call('login_qr_check', { key }, listener);
  } catch (error) {
    if (
      !(
        error instanceof NeteaseError &&
        error.failure.kind === 'rejected' &&
        error.failure.code === 8821
      )
    )
      throw error;
    const verification = verificationOf(error.body);
    if (!verification) throw error;
    const { body } = await call('verify_getQr', verification, listener);
    return { status: 'needsVerification', image: body.data.qrimg };
  }
  const { body, cookie } = response;
  switch (body.code) {
    case 800:
      return { status: 'expired' };
    case 801:
      return { status: 'waiting' };
    case 802:
      return {
        status: 'scanned',
        nickname: body.nickname ?? null,
        avatarUrl: body.avatarUrl ?? null,
      };
    case 803:
      return {
        status: 'confirmed',
        credentials: credentialsFrom('login_qr_check', cookie),
      };
    default: {
      const unhandled: never = body;
      throw new Error(`不认识的扫码状态：${JSON.stringify(unhandled)}`);
    }
  }
};

export const sendCaptcha = async (
  phone: string,
  listener: Listener,
): Promise<void> => {
  await call('captcha_sent', { phone, ctcode: '86' }, listener);
};

const accountOf = (profile: {
  userId: number;
  nickname?: string | null;
  avatarUrl?: string | null;
}): Account => ({
  id: profile.userId,
  nickname: profile.nickname ?? null,
  avatarUrl: profile.avatarUrl ?? null,
});

export const loginWithCaptcha = async (
  phone: string,
  captcha: string,
  listener: Listener,
): Promise<{ credentials: Record<string, string>; account: Account }> => {
  const { body, cookie } = await call(
    'login_cellphone',
    { phone, captcha, countrycode: '86' },
    listener,
  );
  return {
    credentials: credentialsFrom('login_cellphone', cookie),
    account: accountOf(body.profile),
  };
};

export const fetchAccount = async (listener: Listener): Promise<Account> => {
  const { body } = await call('user_account', {}, listener);
  if (!body.account || body.account.anonimousUser || !body.profile)
    throw new NeteaseError({ kind: 'needsLogin' }, body);
  return accountOf(body.profile);
};

export type SignedInListener = Listener & {
  credentials: Record<string, string>;
};

export const renewLogin = async (
  listener: SignedInListener,
): Promise<Record<string, string>> => {
  const { cookie } = await call('login_refresh', {}, listener);
  return credentialsFrom('login_refresh', cookie, listener.credentials);
};

export const logout = async (listener: Listener): Promise<void> => {
  await call('logout', {}, listener);
};

export const fetchHearts = async (
  uid: number,
  listener: Listener,
): Promise<number[]> => {
  const { body } = await call('likelist', { uid }, listener);
  return [...body.ids];
};

const PLAYLISTS_PER_CALL = 1000;
const PRIVATE_PLAYLIST = 10;

const playlistInfo = (playlist: PlaylistSummary): PlaylistInfo => ({
  id: playlist.id,
  name: playlist.name ?? null,
  coverUrl: playlist.coverImgUrl ?? null,
  creator: playlist.creator?.nickname ?? null,
  creatorAvatarUrl: playlist.creator?.avatarUrl ?? null,
  playCount: playlist.playCount ?? null,
  description: playlist.description ?? null,
  tags: [...(playlist.tags ?? [])],
});

const libraryPlaylist = (
  playlist: PlaylistSummary,
  kind: Playlist['kind'],
): Playlist => ({
  ...playlistInfo(playlist),
  kind,
  private: playlist.privacy === PRIVATE_PLAYLIST,
  trackCount: playlist.trackCount ?? null,
  tracksUpdatedAt: playlist.trackUpdateTime ?? null,
});

export const fetchPlaylists = async (
  uid: number,
  listener: Listener,
): Promise<Playlist[]> => {
  const playlists: Playlist[] = [];
  for (let offset = 0; ; offset += PLAYLISTS_PER_CALL) {
    const { body } = await call(
      'user_playlist',
      { uid, limit: PLAYLISTS_PER_CALL, offset },
      listener,
    );
    if (
      body.playlist.length > 0 &&
      body.playlist.every((playlist) => playlist.subscribed === null)
    )
      throw new NeteaseError({ kind: 'needsLogin' }, body);
    for (const playlist of body.playlist) {
      const { specialType } = playlist;
      const creator = playlist.creator?.userId;
      if (specialType == null || creator == null)
        throw shapeChanged(
          'user_playlist',
          `认不出歌单 ${playlist.id} 是哪一类`,
        );
      playlists.push(
        libraryPlaylist(playlist, playlistKindOf(specialType, creator, uid)),
      );
    }
    if (!body.more) return playlists;
  }
};

export const createPlaylist = async (
  name: string,
  isPrivate: boolean,
  listener: Listener,
): Promise<Playlist> => {
  const {
    body: { id },
  } = await call(
    'playlist_create',
    {
      name,
      privacy: String(isPrivate ? PRIVATE_PLAYLIST : 0),
    },
    listener,
  );
  const { body } = await call('playlist_detail', { id }, listener);
  return libraryPlaylist(body.playlist, 'own');
};

export const deletePlaylist = async (
  playlistId: number,
  listener: Listener,
): Promise<WriteResponse> => {
  await call('playlist_delete', { id: playlistId }, listener);
  return { kind: 'done' };
};

export const renamePlaylist = async (
  playlistId: number,
  name: string,
  listener: Listener,
): Promise<WriteResponse> => {
  await call('playlist_name_update', { id: playlistId, name }, listener);
  return { kind: 'done' };
};

export const describePlaylist = async (
  playlistId: number,
  description: string,
  listener: Listener,
): Promise<WriteResponse> => {
  await call(
    'playlist_desc_update',
    { id: playlistId, desc: description },
    listener,
  );
  return { kind: 'done' };
};

export const tagPlaylist = async (
  playlistId: number,
  tags: readonly string[],
  listener: Listener,
): Promise<WriteResponse> => {
  await call(
    'playlist_tags_update',
    {
      id: playlistId,
      tags: tags.join(';'),
    },
    listener,
  );
  return { kind: 'done' };
};

export const publishPlaylist = async (
  playlistId: number,
  listener: Listener,
): Promise<WriteResponse> => {
  await call('playlist_privacy', { id: playlistId }, listener);
  return { kind: 'done' };
};

export const coverUploadToken = async (
  listener: Listener,
): Promise<CoverTokenResponse> => {
  const { body } = await call('image_upload_token', {}, listener);
  return {
    imgId: String(body.data.imgId),
    token: body.data.token,
    uploadUrl: body.data.uploadUrl,
  };
};

// 只在直传成功后调：网易云不检查图片，没传上去也回 200
export const setPlaylistCover = async (
  playlistId: number,
  imgId: string,
  listener: Listener,
): Promise<SetCoverResponse> => {
  const { body } = await call(
    'playlist_cover_update',
    { id: playlistId, imgId },
    listener,
  );
  if (body.code !== 200)
    throw new NeteaseError(
      { kind: 'rejected', code: body.code, message: body.msg ?? '' },
      body,
    );
  return { url: body.data.url ?? null };
};

export const fetchTrackIds = async (
  playlistId: number,
  listener: Listener,
): Promise<number[]> => {
  const { body } = await call('playlist_detail', { id: playlistId }, listener);
  return body.playlist.trackIds.map((track) => track.id);
};

const DELETED_PLAYLIST = 10;
const UNAVAILABLE_CODES: Readonly<Record<number, PlaylistUnavailable>> = {
  404: 'missing',
  401: 'private',
};

export const fetchPlaylistPage = async (
  playlistId: number,
  listener: Listener,
): Promise<PlaylistPageResponse> => {
  const playlist = await call(
    'playlist_detail',
    { id: playlistId },
    listener,
  ).then(
    ({ body }) => body.playlist,
    (error: unknown) => {
      const reason =
        error instanceof NeteaseError && error.failure.kind === 'rejected'
          ? UNAVAILABLE_CODES[error.failure.code]
          : undefined;
      if (!reason) throw error;
      return reason;
    },
  );
  if (typeof playlist === 'string')
    return { kind: 'unavailable', reason: playlist };
  if (playlist.status === DELETED_PLAYLIST)
    return { kind: 'unavailable', reason: 'deleted' };
  return {
    kind: 'shown',
    playlist: playlistInfo(playlist),
    trackIds: playlist.trackIds.map((track) => track.id),
    tracksUpdatedAt: playlist.trackUpdateTime ?? null,
  };
};

export const fetchPlaylistTags = async (
  listener: Listener,
): Promise<PlaylistTagGroup[]> => {
  const { body } = await call('playlist_catlist', {}, listener);
  return Object.entries(body.categories)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([category, name]) => ({
      name,
      tags: body.sub
        .filter((tag) => tag.category === Number(category))
        .map((tag) => tag.name),
    }));
};

interface NeteaseArtist {
  readonly id?: number | null;
  readonly name?: string | null;
}

interface NeteaseSong {
  readonly id: number;
  readonly name?: string | null;
  readonly ar?: readonly NeteaseArtist[] | null;
  readonly al?: {
    readonly id?: number | null;
    readonly name?: string | null;
    readonly picUrl?: string | null;
  } | null;
  readonly dt?: number | null;
  readonly h?: { readonly size?: number | null } | null;
  readonly no?: number | null;
  readonly cd?: string | null;
  readonly alia?: readonly string[] | null;
  readonly tns?: readonly string[] | null;
  readonly publishTime?: number | null;
}

interface Privilege {
  readonly st?: number | null;
  readonly pl?: number | null;
}

const availabilityOf = (
  privilege: Privilege | null | undefined,
): Availability => {
  const { st, pl } = privilege ?? {};
  if (st != null && st < 0) return 'noCopyright';
  return pl == null || pl > 0 ? 'full' : 'trial';
};

const creditOf = (artist: NeteaseArtist | null | undefined): Credit => ({
  id: artist?.id ?? null,
  name: artist?.name ?? null,
});

const songOf = (
  song: NeteaseSong,
  privilege: Privilege | null | undefined,
): Song => ({
  id: song.id,
  name: song.name ?? null,
  artists: (song.ar ?? []).map(creditOf),
  album: {
    id: song.al?.id ?? null,
    name: song.al?.name ?? null,
    coverUrl: song.al?.picUrl ?? null,
  },
  duration: song.dt ?? null,
  downloadSize: song.h?.size ?? null,
  availability: availabilityOf(privilege),
  trackNumber: song.no ?? null,
  disc: song.cd ?? null,
  aliases: [...(song.alia ?? [])],
  translations: [...(song.tns ?? [])],
  publishedAt: song.publishTime ?? null,
});

const songWithPrivilegeOf = (
  song: NeteaseSong & { readonly privilege?: Privilege | null },
): Song => songOf(song, song.privilege);

export const fetchSongs = async (
  ids: readonly number[],
  listener: Listener,
): Promise<Song[]> => {
  const { body } = await call(
    'song_detail',
    {
      ids: ids.join(','),
    },
    listener,
  );
  const byId = new Map(body.songs.map((song) => [song.id, song]));
  const privileges = new Map(
    body.privileges.map((privilege) => [privilege.id, privilege]),
  );
  return ids.flatMap((id) => {
    const song = byId.get(id);
    return song ? [songOf(song, privileges.get(id))] : [];
  });
};

const https = (url: string): string => url.replace(/^http:\/\//, 'https://');

const PLAY_URL_LIFETIME_SECONDS = 1200;

export const fetchPlayUrl = async (
  songId: number,
  quality: Quality,
  listener: Listener,
): Promise<PlayUrlResponse> => {
  const { body } = await call(
    'song_url_v1',
    { id: songId, level: quality },
    listener,
  );
  const item = body.data.find((data) => data.id === songId);
  if (!item?.url) return { playable: false };
  return {
    playable: true,
    url: https(item.url),
    trial: item.freeTrialInfo != null,
    expiresIn: item.expi ?? PLAY_URL_LIFETIME_SECONDS,
  };
};

export const fetchDownloadUrl = async (
  songId: number,
  quality: Quality,
  listener: Listener,
): Promise<DownloadUrlResponse> => {
  const { body } = await call(
    'song_download_url_v1',
    { id: songId, level: quality },
    listener,
  );
  if (body.data.id !== songId)
    throw shapeChanged(
      'song_download_url_v1',
      `要的是歌曲 ${songId}，回的是 ${body.data.id}`,
    );
  if (!body.data.url) return { downloadable: false };
  return {
    downloadable: true,
    url: https(body.data.url),
    size: body.data.size ?? null,
  };
};

const checkInSourceOf = (
  source: PlaySource,
): { source: string; sourceid: number } => {
  switch (source.kind) {
    case 'playlist':
      return { source: 'list', sourceid: source.id };
    case 'album':
    case 'artist':
      return { source: source.kind, sourceid: source.id };
    case 'daily':
      return { source: 'recommend', sourceid: 0 };
    case 'search':
      return { source: 'search', sourceid: 0 };
    case 'downloads':
      return { source: 'download', sourceid: 0 };
    default: {
      const unhandled: never = source;
      throw new Error(`不认识的播放来源：${JSON.stringify(unhandled)}`);
    }
  }
};

export const checkIn = async (
  songId: number,
  source: PlaySource,
  seconds: number,
  listener: Listener,
): Promise<WriteResponse> => {
  await call(
    'scrobble',
    {
      id: songId,
      ...checkInSourceOf(source),
      time: seconds,
    },
    listener,
  );
  return { kind: 'done' };
};

export const fetchLyrics = async (
  songId: number,
  listener: Listener,
): Promise<LyricsResponse> => {
  const { body } = await call('lyric_new', { id: songId }, listener);
  return lyricsOf(body);
};

const COLLECTED_PER_CALL = 1000;

const everyPage = async <T>(
  page: (
    offset: number,
  ) => Promise<{ items: T[]; hasMore: boolean | null | undefined }>,
): Promise<T[]> => {
  const items: T[] = [];
  for (let offset = 0; ; offset += COLLECTED_PER_CALL) {
    const next = await page(offset);
    items.push(...next.items);
    if (!next.hasMore) return items;
  }
};

export const fetchCollectedAlbums = (
  listener: Listener,
): Promise<CollectedAlbum[]> =>
  everyPage(async (offset) => {
    const { body } = await call(
      'album_sublist',
      { limit: COLLECTED_PER_CALL, offset },
      listener,
    );
    return {
      items: body.data.map((album) => ({
        id: album.id,
        name: album.name ?? null,
        coverUrl: album.picUrl ?? null,
        artists: (album.artists ?? []).map(creditOf),
        songCount: album.size ?? null,
      })),
      hasMore: body.hasMore,
    };
  });

export const fetchCollectedArtists = (
  listener: Listener,
): Promise<CollectedArtist[]> =>
  everyPage(async (offset) => {
    const { body } = await call(
      'artist_sublist',
      { limit: COLLECTED_PER_CALL, offset },
      listener,
    );
    return {
      items: body.data.map((artist) => ({
        id: artist.id,
        name: artist.name ?? null,
        avatarUrl: artist.picUrl ?? null,
      })),
      hasMore: body.hasMore,
    };
  });

export const fetchAlbum = async (
  albumId: number,
  listener: Listener,
): Promise<AlbumResponse> => {
  const {
    body: { album, songs },
  } = await call('album', { id: albumId }, listener);
  return {
    album: {
      id: album.id,
      name: album.name ?? null,
      coverUrl: album.picUrl ?? null,
      artist: creditOf(album.artist),
      publishedAt: album.publishTime ?? null,
      description: album.description ?? null,
      songCount: album.size ?? null,
      company: album.company ?? null,
    },
    songs: songs.map(songWithPrivilegeOf),
  };
};

const artistAlbums = (artistId: number, offset: number, listener: Listener) =>
  call(
    'artist_album',
    { id: artistId, limit: ARTIST_ALBUMS_PER_REQUEST, offset },
    listener,
  );

const artistAlbumOf = (album: {
  id: number;
  name?: string | null;
  picUrl?: string | null;
  publishTime?: number | null;
}): ArtistAlbum => ({
  id: album.id,
  name: album.name ?? null,
  coverUrl: album.picUrl ?? null,
  publishedAt: album.publishTime ?? null,
});

export const fetchArtistSongs = async (
  artistId: number,
  order: ArtistSongOrder,
  offset: number,
  listener: Listener,
): Promise<ArtistSongsResponse> => {
  const { body } = await call(
    'artist_songs',
    {
      id: artistId,
      order,
      limit: ARTIST_SONGS_PER_REQUEST,
      offset,
    },
    listener,
  );
  return {
    songs: body.songs.map(songWithPrivilegeOf),
    more: body.more ?? false,
    total: body.total ?? null,
  };
};

export const fetchArtist = async (
  artistId: number,
  listener: Listener,
): Promise<ArtistResponse> => {
  const [songs, albums] = await Promise.all([
    fetchArtistSongs(artistId, 'hot', 0, listener),
    artistAlbums(artistId, 0, listener),
  ]);
  const { artist } = albums.body;
  return {
    artist: {
      id: artistId,
      name: artist?.name ?? null,
      avatarUrl: artist?.img1v1Url ?? null,
      songCount: artist?.musicSize ?? null,
      albumCount: artist?.albumSize ?? null,
    },
    songs,
    albums: albums.body.hotAlbums.map(artistAlbumOf),
    moreAlbums: albums.body.more ?? false,
  };
};

export const fetchArtistAlbums = async (
  artistId: number,
  offset: number,
  listener: Listener,
): Promise<ArtistAlbumsResponse> => {
  const { body } = await artistAlbums(artistId, offset, listener);
  return {
    albums: body.hotAlbums.map(artistAlbumOf),
    more: body.more ?? false,
  };
};

export const fetchArtistIntro = async (
  artistId: number,
  listener: Listener,
): Promise<ArtistIntroResponse> => {
  const { body } = await call('artist_desc', { id: artistId }, listener);
  return {
    brief: body.briefDesc?.trim() || null,
    sections: body.introduction.flatMap((section) => {
      const text = section.txt?.trim();
      return text ? [{ title: section.ti?.trim() || null, text }] : [];
    }),
  };
};

export const fetchDaily = async (
  listener: Listener,
): Promise<DailyResponse> => {
  const { body } = await call('recommend_songs', {}, listener);
  return {
    songs: body.data.dailySongs.map(songWithPrivilegeOf),
  };
};

export const heart = async (
  songId: number,
  hearted: boolean,
  listener: Listener,
): Promise<WriteResponse> => {
  await call('like', { id: songId, like: hearted }, listener);
  return { kind: 'done' };
};

const TRACKS_DUPLICATE = 502;
const PLAYLIST_MISSING = 404;
const ALBUM_NOT_COLLECTED = 404;

const rejection = (
  error: unknown,
): Extract<NeteaseFailure, { kind: 'rejected' }> | null =>
  error instanceof NeteaseError && error.failure.kind === 'rejected'
    ? error.failure
    : null;

const missing = (error: unknown): { kind: 'missing' } | null =>
  rejection(error)?.code === PLAYLIST_MISSING ? { kind: 'missing' } : null;

export const addTracks = async (
  playlistId: number,
  songIds: readonly number[],
  listener: Listener,
): Promise<WriteResponse> => {
  try {
    await call(
      'playlist_tracks',
      {
        op: 'add',
        pid: playlistId,
        tracks: songIds.join(','),
      },
      listener,
    );
  } catch (error) {
    const refused = rejection(error);
    if (
      refused?.code === TRACKS_DUPLICATE &&
      refused.message.includes('歌单内歌曲重复')
    )
      return { kind: 'done' };
    const gone = missing(error);
    if (gone) return gone;
    throw error;
  }
  return { kind: 'done' };
};

export const removeTracks = async (
  playlistId: number,
  songIds: readonly number[],
  listener: Listener,
): Promise<WriteResponse> => {
  try {
    await call(
      'playlist_tracks',
      {
        op: 'del',
        pid: playlistId,
        tracks: songIds.join(','),
      },
      listener,
    );
  } catch (error) {
    const gone = missing(error);
    if (gone) return gone;
    throw error;
  }
  return { kind: 'done' };
};

// 整张歌单排序回 -1“请求异常”：几千首位置都变时其实已经生效
const ORDER_UNCONFIRMED = -1;

export const updateSongOrder = async (
  playlistId: number,
  songIds: readonly number[],
  listener: Listener,
): Promise<WriteResponse> => {
  try {
    await call(
      'song_order_update',
      {
        pid: playlistId,
        ids: JSON.stringify(songIds),
      },
      listener,
    );
  } catch (error) {
    if (rejection(error)?.code === ORDER_UNCONFIRMED)
      return { kind: 'unconfirmed' };
    const gone = missing(error);
    if (gone) return gone;
    throw error;
  }
  return { kind: 'done' };
};

export const updatePlaylistOrder = async (
  playlistIds: readonly number[],
  listener: Listener,
): Promise<WriteResponse> => {
  await call(
    'playlist_order_update',
    {
      ids: JSON.stringify(playlistIds),
    },
    listener,
  );
  return { kind: 'done' };
};

export const collectAlbum = async (
  albumId: number,
  collected: boolean,
  listener: Listener,
): Promise<WriteResponse> => {
  await call(
    'album_sub',
    {
      id: albumId,
      t: collected ? 1 : 0,
    },
    listener,
  ).catch((error: unknown) => {
    if (collected || rejection(error)?.code !== ALBUM_NOT_COLLECTED)
      throw error;
  });
  return { kind: 'done' };
};

export const collectArtist = async (
  artistId: number,
  collected: boolean,
  listener: Listener,
): Promise<WriteResponse> => {
  await call(
    'artist_sub',
    {
      id: artistId,
      t: collected ? 1 : 0,
    },
    listener,
  );
  return { kind: 'done' };
};

export const collectPlaylist = async (
  playlistId: number,
  change: PlaylistCollectRequest,
  listener: Listener,
): Promise<WriteResponse> => {
  try {
    await call(
      'playlist_subscribe',
      {
        id: playlistId,
        t: change.collected ? 1 : 0,
      },
      listener,
      change.collected ? change.checkToken : undefined,
    );
  } catch (error) {
    const gone = missing(error);
    if (gone) return gone;
    throw error;
  }
  return { kind: 'done' };
};

const lookalike = (name: string): string =>
  name.normalize('NFKC').replace(/[\u301C\u223C]/g, '~');

export const fetchSuggestions = async (
  keywords: string,
  listener: Listener,
): Promise<SuggestionsResponse> => {
  const { body } = await call('search_suggest', { keywords }, listener);
  const { songs, artists, albums, playlists } = body.result;
  const named = <T extends { id: number; name?: string | null }>(
    items: readonly T[] | null | undefined,
  ) =>
    (items ?? []).flatMap(({ id, name }) =>
      name == null ? [] : [{ id, name }],
    );
  const songNames = named(songs).map((song) => song.name);
  const looks = songNames.map(lookalike);
  return {
    suggestions: [
      ...songNames
        .filter((_, index) => looks.indexOf(looks[index]) === index)
        .map((name) => ({ kind: 'song' as const, name })),
      ...named(artists).map((artist) => ({
        kind: 'artist' as const,
        ...artist,
      })),
      ...named(albums).map((album) => ({ kind: 'album' as const, ...album })),
      ...named(playlists).map((playlist) => ({
        kind: 'playlist' as const,
        ...playlist,
      })),
    ],
  };
};

const CLOUDSEARCH_TYPES: Record<SearchKind, number> = {
  songs: 1,
  playlists: 1000,
  artists: 100,
  albums: 10,
};

const cloudsearch = async (
  kind: SearchKind,
  keywords: string,
  offset: number,
  listener: Listener,
) => {
  const { body } = await call(
    'cloudsearch',
    {
      keywords,
      type: CLOUDSEARCH_TYPES[kind],
      limit: SEARCH_RESULTS_PER_REQUEST,
      offset,
    },
    listener,
  );
  return body.result;
};

export const searches: {
  [K in SearchKind]: (
    keywords: string,
    offset: number,
    listener: Listener,
  ) => Promise<SearchPageResponse<K>>;
} = {
  async songs(keywords, offset, listener) {
    const { songs, songCount } = await cloudsearch(
      'songs',
      keywords,
      offset,
      listener,
    );
    return {
      items: (songs ?? []).map(songWithPrivilegeOf),
      total: songCount ?? null,
    };
  },
  async playlists(keywords, offset, listener) {
    const { playlists, playlistCount } = await cloudsearch(
      'playlists',
      keywords,
      offset,
      listener,
    );
    return {
      items: (playlists ?? []).map((playlist) => ({
        id: playlist.id,
        name: playlist.name ?? null,
        coverUrl: playlist.coverImgUrl ?? null,
        creator: playlist.creator?.nickname ?? null,
        trackCount: playlist.trackCount ?? null,
        playCount: playlist.playCount ?? null,
      })),
      total: playlistCount ?? null,
    };
  },
  async artists(keywords, offset, listener) {
    const { artists, artistCount } = await cloudsearch(
      'artists',
      keywords,
      offset,
      listener,
    );
    return {
      items: (artists ?? []).map((artist) => ({
        id: artist.id,
        name: artist.name ?? null,
        avatarUrl: artist.picUrl ?? null,
        songCount: artist.musicSize ?? null,
      })),
      total: artistCount ?? null,
    };
  },
  async albums(keywords, offset, listener) {
    const { albums, albumCount } = await cloudsearch(
      'albums',
      keywords,
      offset,
      listener,
    );
    return {
      items: (albums ?? []).map((album) => ({
        id: album.id,
        name: album.name ?? null,
        coverUrl: album.picUrl ?? null,
        artists: (album.artists ?? []).map(creditOf),
        publishedAt: album.publishTime ?? null,
      })),
      total: albumCount ?? null,
    };
  },
};
