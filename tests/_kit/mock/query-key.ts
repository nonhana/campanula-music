// 上千个编号的查询串在索引里换成摘要，免得索引涨到 MB 级；匹配时两边算同一个键
import { createHash } from 'node:crypto';

const LONG_VALUE = 256;

// 历史录制保留原始输入；只在替身匹配时把 SDK 5 的业务值换成当时的表示。
export const recordedQuery = (
  module: string,
  query: Record<string, unknown>,
): Record<string, unknown> => {
  const result = { ...query };
  if (module === 'song_detail' && Array.isArray(result.ids))
    result.ids = result.ids.join(',');
  if (module === 'playlist_tracks' && Array.isArray(result.tracks))
    result.tracks = result.tracks.join(',');
  if (
    (module === 'song_order_update' || module === 'playlist_order_update') &&
    Array.isArray(result.ids)
  )
    result.ids = JSON.stringify(result.ids);
  if (module === 'playlist_tags_update' && Array.isArray(result.tags))
    result.tags = result.tags.join(';');
  if (module === 'song_url_v1' && Array.isArray(result.ids)) {
    result.id = result.ids.length === 1 ? result.ids[0] : result.ids.join(',');
    delete result.ids;
  }
  if (module === 'playlist_create' && typeof result.privacy === 'number')
    result.privacy = String(result.privacy);
  return result;
};

const digest = (value: string): string =>
  `#sha256:${createHash('sha256').update(value).digest('hex')}:${value.length}`;

const canonical = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.length > LONG_VALUE ? digest(value) : value;
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonical((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  return value;
};

export const queryKey = (query: unknown, module?: string): string =>
  JSON.stringify(
    canonical(
      module &&
        typeof query === 'object' &&
        query !== null &&
        !Array.isArray(query)
        ? recordedQuery(module, query as Record<string, unknown>)
        : query,
    ),
  );
