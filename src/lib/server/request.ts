import { error } from '@sveltejs/kit';

import type { CheckTokens } from '#lib/api/check-token.js';
import { CHECK_TOKEN, CHECK_TOKENS_HEADER } from '#lib/api/check-token.js';
import type { SetCoverRequest } from '#lib/api/cover.js';
import type { PostEndpoint } from '#lib/api/endpoint.js';
import type {
  ArtistSongOrder,
  CollectRequest,
  CreatePlaylistRequest,
  DescribePlaylistRequest,
  HeartRequest,
  RenamePlaylistRequest,
  TagPlaylistRequest,
} from '#lib/api/library.js';
import {
  ARTIST_SONG_ORDERS,
  nameProblem,
  PLAYLIST_DESCRIPTION_LENGTH,
  PLAYLIST_NAME_WIDTH,
  PLAYLIST_TAGS_MAX,
} from '#lib/api/library.js';
import type { CheckInRequest, PlaySource, Quality } from '#lib/api/playback.js';
import { NUMBERED_SOURCE_KINDS, QUALITIES } from '#lib/api/playback.js';
import type { SearchKind } from '#lib/api/search.js';
import { SEARCH_KINDS } from '#lib/api/search.js';

export const QR_KEY = /^[\w-]{1,64}$/;
export const readCheckTokens = (request: Request): CheckTokens => {
  const raw = request.headers.get(CHECK_TOKENS_HEADER);
  if (raw === null) return { requests: [] };
  // JSON 会把引号和反斜杠转成两字符，需容下四枚最长令牌和字段名。
  if (raw.length > 4 * 1024 * 2 + 100) error(400, '安全验证令牌太长');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    error(400, '安全验证令牌的格式不对');
  }
  if (
    typeof body !== 'object' ||
    body === null ||
    !('requests' in body) ||
    !Array.isArray(body.requests) ||
    body.requests.length > 3 ||
    !body.requests.every(
      (token: unknown) => typeof token === 'string' && CHECK_TOKEN.test(token),
    )
  )
    error(400, '安全验证令牌的格式不对');
  const renewal = 'renewal' in body ? body.renewal : undefined;
  if (
    renewal !== undefined &&
    (typeof renewal !== 'string' || !CHECK_TOKEN.test(renewal))
  )
    error(400, '续期令牌的格式不对');
  return { requests: body.requests, renewal };
};

export const readFields = async <K extends string>(
  request: Request,
  patterns: Record<K, RegExp>,
): Promise<Record<K, string>> => {
  const body: unknown = await request.json().catch(() => null);
  const fields = {} as Record<K, string>;
  for (const name of Object.keys(patterns) as K[]) {
    const value =
      typeof body === 'object' && body !== null && name in body
        ? (body as Record<K, unknown>)[name]
        : undefined;
    if (typeof value !== 'string' || !patterns[name].test(value))
      error(400, `${name} 的格式不对`);
    fields[name] = value;
  }
  return fields;
};

const isNeteaseId = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;

export const readId = (
  name: string,
  value: string | null | undefined,
): number => {
  const id = /^\d{1,16}$/.test(value ?? '') ? Number(value) : Number.NaN;
  if (!isNeteaseId(id)) error(400, `${name} 的格式不对`);
  return id;
};

type IdListKey<Body> = {
  [K in keyof Body]-?: Body[K] extends number[] ? K : never;
}[keyof Body] &
  string;

export const readIds = async <Body>(
  _endpoint: Pick<PostEndpoint<unknown, Body, unknown>, 'request'>,
  request: Request,
  name: IdListKey<NonNullable<Body>>,
  max: number,
): Promise<number[]> => {
  const body: unknown = await request.json().catch(() => null);
  const ids =
    typeof body === 'object' && body !== null && name in body
      ? (body as Record<string, unknown>)[name]
      : undefined;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > max ||
    !ids.every(isNeteaseId)
  )
    error(400, `${name} 要有 1 到 ${max} 个编号`);
  return ids;
};

export const readOffset = (value: string | null): number => {
  if (!/^\d{1,6}$/.test(value ?? '')) error(400, 'offset 的格式不对');
  return Number(value);
};

export const readQuality = (value: string | null): Quality => {
  const quality = QUALITIES.find((item) => item === value);
  if (!quality) error(400, 'quality 的格式不对');
  return quality;
};

export const readKeywords = (value: string | null): string => {
  const keywords = value?.trim() ?? '';
  if (!keywords) error(400, 'keywords 不能是空的');
  return keywords;
};

export const readSearchKind = (value: string): SearchKind => {
  const kind = SEARCH_KINDS.find((each) => each === value);
  if (!kind) error(400, 'kind 的格式不对');
  return kind;
};

export const readArtistSongOrder = (value: string | null): ArtistSongOrder => {
  const order = ARTIST_SONG_ORDERS.find((each) => each === value);
  if (!order) error(400, 'order 的格式不对');
  return order;
};

const readSource = (source: unknown): PlaySource => {
  const { kind, id, keyword } = (
    typeof source === 'object' && source !== null ? source : {}
  ) as Partial<Record<'kind' | 'id' | 'keyword', unknown>>;
  if (kind === 'daily' || kind === 'downloads') return { kind };
  if (kind === 'search') {
    if (typeof keyword !== 'string' || !keyword.trim())
      error(400, 'source 的格式不对');
    return { kind, keyword };
  }
  const numbered = NUMBERED_SOURCE_KINDS.find((each) => each === kind);
  if (!numbered || !isNeteaseId(id)) error(400, 'source 的格式不对');
  return { kind: numbered, id };
};

export const readCheckIn = async (
  request: Request,
): Promise<CheckInRequest> => {
  const body: unknown = await request.json().catch(() => null);
  const { source, seconds } = (
    typeof body === 'object' && body !== null ? body : {}
  ) as Partial<Record<keyof CheckInRequest, unknown>>;
  const playSource = readSource(source);
  if (!Number.isSafeInteger(seconds) || (seconds as number) <= 0)
    error(400, 'seconds 要是正整数');
  return { source: playSource, seconds: seconds as number };
};

const readObject = async (
  request: Request,
): Promise<Record<string, unknown>> => {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
};

export const readHeart = async (request: Request): Promise<HeartRequest> => {
  const { songId, hearted } = await readObject(request);
  if (!isNeteaseId(songId) || typeof hearted !== 'boolean')
    error(400, '要有 songId 和 hearted');
  return { songId, hearted };
};

export const readCollect = async (
  request: Request,
): Promise<CollectRequest> => {
  const { collected } = await readObject(request);
  if (typeof collected !== 'boolean') error(400, '要有 collected');
  return { collected };
};

const readPlaylistName = (name: unknown): string => {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (nameProblem(trimmed))
    error(400, `name 要有 1 到 ${PLAYLIST_NAME_WIDTH} 个宽度（汉字算 2）`);
  return trimmed;
};

export const readPlaylistDraft = async (
  request: Request,
): Promise<CreatePlaylistRequest> => {
  const { name, private: isPrivate } = await readObject(request);
  if (typeof isPrivate !== 'boolean') error(400, '要有 private');
  return {
    name: readPlaylistName(name),
    private: isPrivate,
  };
};

export const readPlaylistRename = async (
  request: Request,
): Promise<RenamePlaylistRequest> => {
  const { name } = await readObject(request);
  return {
    name: readPlaylistName(name),
  };
};

export const readPlaylistDescription = async (
  request: Request,
): Promise<DescribePlaylistRequest> => {
  const { description } = await readObject(request);
  if (
    typeof description !== 'string' ||
    description.length > PLAYLIST_DESCRIPTION_LENGTH
  )
    error(400, `description 最多 ${PLAYLIST_DESCRIPTION_LENGTH} 个字`);
  return { description };
};

// 网易云用分号把标签连起来交上去，所以标签里不能有分号
const TAG = /^[^;\s][^;]*$/;

export const readPlaylistTags = async (
  request: Request,
): Promise<TagPlaylistRequest> => {
  const { tags } = await readObject(request);
  if (
    !Array.isArray(tags) ||
    tags.length > PLAYLIST_TAGS_MAX ||
    !tags.every((tag) => typeof tag === 'string' && TAG.test(tag)) ||
    new Set(tags).size !== tags.length
  )
    error(400, `tags 要有 0 到 ${PLAYLIST_TAGS_MAX} 个不重复的标签`);
  return { tags };
};

export const readCoverImage = async (
  request: Request,
): Promise<SetCoverRequest> => {
  const { imgId } = await readObject(request);
  if (typeof imgId !== 'string' || !/^\d{1,20}$/.test(imgId))
    error(400, 'imgId 的格式不对');
  return { imgId };
};
