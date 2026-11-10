import { playlistName } from '#lib/api/library.js';
import type { PlaylistPage } from '#lib/app/library.js';

import { formatCount, formatPlays } from '../shared/text';

export interface PlaylistHeader {
  name: string;
  coverUrl: string | null;
  creator: string | null;
  creatorAvatarUrl: string | null;
  meta: string[];
  private: boolean;
  description: string | null;
  tags: readonly string[];
}

export const playlistHeader = (page: PlaylistPage): PlaylistHeader | null => {
  const info = page.info;
  if (!info) return null;
  const count =
    page.count === null
      ? null
      : page.songs.kind === 'songs' && !page.songs.complete
        ? `${formatCount(page.count.loaded)} / ${formatCount(page.count.total)} 首`
        : `${formatCount(page.count.total)} 首`;
  const plays =
    info.playCount !== null && info.playCount > 0
      ? `播放 ${formatPlays(info.playCount)}`
      : null;
  return {
    name: playlistName({ name: info.name, kind: page.kind }),
    coverUrl: info.coverUrl,
    creator: info.creator,
    creatorAvatarUrl: info.creatorAvatarUrl,
    meta: [count, plays].filter((part): part is string => Boolean(part)),
    private: page.private,
    description: info.description?.trim() || null,
    tags: info.tags,
  };
};
