import type { ModuleCallConfig } from 'hana-music-api';
import {
  lyricNew,
  scrobble,
  songDownloadUrlV1,
  songUrlV1,
} from 'hana-music-api';

import type {
  DownloadUrlResponse,
  LyricsResponse,
  PlaySource,
  PlayUrlResponse,
  Quality,
} from '#lib/api/playback.js';
import type { WriteResponse } from '#lib/api/write.js';

import { lyricsOf } from '../lyrics';
import { shapeChanged } from './failure';

const https = (url: string): string => url.replace(/^http:\/\//, 'https://');

const PLAY_URL_LIFETIME_SECONDS = 1200;

export const fetchPlayUrl = async (
  songId: number,
  quality: Quality,
  config: ModuleCallConfig,
): Promise<PlayUrlResponse> => {
  const { body } = await songUrlV1({ ids: [songId], level: quality }, config);
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
  config: ModuleCallConfig,
): Promise<DownloadUrlResponse> => {
  const { body } = await songDownloadUrlV1(
    { id: songId, level: quality },
    config,
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
): {
  source: string;
  sourceid: number;
} => {
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
  config: ModuleCallConfig,
): Promise<WriteResponse> => {
  await scrobble(
    {
      id: songId,
      ...checkInSourceOf(source),
      time: seconds,
    },
    config,
  );
  return { kind: 'done' };
};

export const fetchLyrics = async (
  songId: number,
  config: ModuleCallConfig,
): Promise<LyricsResponse> => {
  const { body } = await lyricNew({ id: songId }, config);
  return lyricsOf(body);
};
