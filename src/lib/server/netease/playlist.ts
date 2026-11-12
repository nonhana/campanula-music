import type { ModuleCallConfig, PlaylistSummary } from 'hana-music-api';
import {
  imageUploadToken,
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
  songOrderUpdate,
  userPlaylist,
} from 'hana-music-api';

import type { CoverTokenResponse, SetCoverResponse } from '#lib/api/cover.js';
import type {
  Playlist,
  PlaylistCollectRequest,
  PlaylistInfo,
  PlaylistPageResponse,
  PlaylistTagGroup,
  PlaylistUnavailable,
} from '#lib/api/library.js';
import { playlistKindOf } from '#lib/api/library.js';
import type { WriteResponse } from '#lib/api/write.js';

import { NeteaseError, rejection, shapeChanged } from './failure';

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
  config: ModuleCallConfig,
): Promise<Playlist[]> => {
  const playlists: Playlist[] = [];
  for (let offset = 0; ; offset += PLAYLISTS_PER_CALL) {
    const { body } = await userPlaylist(
      { uid, limit: PLAYLISTS_PER_CALL, offset },
      config,
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
  config: ModuleCallConfig,
): Promise<number> => {
  const {
    body: { id },
  } = await playlistCreate(
    {
      name,
      privacy: isPrivate ? PRIVATE_PLAYLIST : 0,
    },
    config,
  );
  return id;
};

export const fetchCreatedPlaylist = async (
  id: number,
  config: ModuleCallConfig,
): Promise<Playlist> => {
  const { body } = await playlistDetail({ id }, config);
  return libraryPlaylist(body.playlist, 'own');
};

export const deletePlaylist = async (
  playlistId: number,
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  await playlistDelete({ id: playlistId }, config);
  return { kind: 'done' };
};

export const renamePlaylist = async (
  playlistId: number,
  name: string,
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  await playlistNameUpdate({ id: playlistId, name }, config);
  return { kind: 'done' };
};

export const describePlaylist = async (
  playlistId: number,
  description: string,
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  await playlistDescUpdate({ id: playlistId, desc: description }, config);
  return { kind: 'done' };
};

export const tagPlaylist = async (
  playlistId: number,
  tags: readonly string[],
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  await playlistTagsUpdate(
    {
      id: playlistId,
      tags,
    },
    config,
  );
  return { kind: 'done' };
};

export const publishPlaylist = async (
  playlistId: number,
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  await playlistPrivacy({ id: playlistId }, config);
  return { kind: 'done' };
};

export const coverUploadToken = async (
  config: ModuleCallConfig,
): Promise<CoverTokenResponse> => {
  const { body } = await imageUploadToken({}, config);
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
  config: ModuleCallConfig,
): Promise<SetCoverResponse> => {
  const { body } = await playlistCoverUpdate({ id: playlistId, imgId }, config);
  if (body.code !== 200)
    throw new NeteaseError(
      { kind: 'rejected', code: body.code, message: body.msg ?? '' },
      body,
    );
  return { url: body.data.url ?? null };
};

export const fetchTrackIds = async (
  playlistId: number,
  config: ModuleCallConfig,
): Promise<number[]> => {
  const { body } = await playlistDetail({ id: playlistId }, config);
  return body.playlist.trackIds.map((track) => track.id);
};

const DELETED_PLAYLIST = 10;

const UNAVAILABLE_CODES: Readonly<Record<number, PlaylistUnavailable>> = {
  404: 'missing',
  401: 'private',
};

export const fetchPlaylistPage = async (
  playlistId: number,
  config: ModuleCallConfig,
): Promise<PlaylistPageResponse> => {
  const playlist = await playlistDetail({ id: playlistId }, config).then(
    ({ body }) => body.playlist,
    (error: unknown) => {
      const reason = UNAVAILABLE_CODES[rejection(error)?.code ?? 0];
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
  config: ModuleCallConfig,
): Promise<PlaylistTagGroup[]> => {
  const { body } = await playlistCatlist({}, config);
  return Object.entries(body.categories)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([category, name]) => ({
      name,
      tags: body.sub
        .filter((tag) => tag.category === Number(category))
        .map((tag) => tag.name),
    }));
};

const TRACKS_DUPLICATE = 502;

const PLAYLIST_MISSING = 404;

const missing = (
  error: unknown,
): {
  kind: 'missing';
} | null =>
  rejection(error)?.code === PLAYLIST_MISSING ? { kind: 'missing' } : null;

export const addTracks = async (
  playlistId: number,
  songIds: readonly number[],
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  try {
    await playlistTracks(
      {
        op: 'add',
        pid: playlistId,
        tracks: songIds,
      },
      config,
    );
  } catch (error) {
    const refused = rejection(error);
    if (
      refused?.code === TRACKS_DUPLICATE &&
      refused.message?.includes('歌单内歌曲重复')
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
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  try {
    await playlistTracks(
      {
        op: 'del',
        pid: playlistId,
        tracks: songIds,
      },
      config,
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
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  try {
    await songOrderUpdate(
      {
        pid: playlistId,
        ids: songIds,
      },
      config,
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
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  await playlistOrderUpdate(
    {
      ids: playlistIds,
    },
    config,
  );
  return { kind: 'done' };
};

export const collectPlaylist = async (
  playlistId: number,
  change: PlaylistCollectRequest,
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  try {
    await playlistSubscribe(
      {
        id: playlistId,
        t: change.collected ? 1 : 0,
      },
      change.collected ? { ...config, checkToken: change.checkToken } : config,
    );
  } catch (error) {
    const gone = missing(error);
    if (gone) return gone;
    throw error;
  }
  return { kind: 'done' };
};
