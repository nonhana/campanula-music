import type { Song } from '#lib/api/library.js';
import { playlistName, songTitle } from '#lib/api/library.js';
import type { LyricLine, LyricWord, PlaySource } from '#lib/api/playback.js';
import type { LibraryState } from '#lib/app/library.js';
import type {
  PlayerNotice,
  PlayerState,
  PlayMode,
  SongChange,
} from '#lib/app/player.js';

import { failureText } from '../shared/failure';
import { formatDuration } from '../shared/text';

export const queueEmpty = (player: PlayerState): boolean =>
  player.queue.length === 0;

export const neighborSong = (
  player: PlayerState,
  direction: keyof PlayerState['neighbors'],
): Song | null => {
  const index = player.neighbors[direction];
  return index === null ? null : player.queue[index].song;
};

export const SMALL_COVER = 48;

export const PAGE_COVER = { desktop: 420, phone: 360 } as const;

export type Turn = 'left' | 'right' | 'land';

export type Place = 'page' | 'bar';

export const turnOf = (change: SongChange | null): Turn | null => {
  switch (change) {
    case null:
      return null;
    case 'next':
    case 'continue':
    case 'skip':
    case 'pick':
      return 'left';
    case 'previous':
      return 'right';
    default: {
      const unhandled: never = change;
      throw new Error(`不认识的换歌原因：${JSON.stringify(unhandled)}`);
    }
  }
};

export const formatSeconds = (seconds: number): string =>
  formatDuration(seconds * 1000);

export const sourceName = (
  library: LibraryState | null,
  source: PlaySource,
): string | null => {
  if (source.kind === 'downloads') return '已下载';
  if (!library) return null;
  switch (source.kind) {
    case 'playlist': {
      const playlist = library.playlists?.find((each) => each.id === source.id);
      return playlist ? playlistName(playlist) : null;
    }
    case 'album': {
      const page = library.albumPage(source.id);
      return page?.status === 'shown'
        ? page.content.album.name
        : (library.albums?.find((album) => album.id === source.id)?.name ??
            null);
    }
    case 'artist': {
      const page = library.artistPage(source.id);
      return page?.status === 'shown'
        ? page.content.artist.name
        : (library.artists?.find((artist) => artist.id === source.id)?.name ??
            null);
    }
    case 'daily':
      return '每日推荐';
    case 'search':
      return `搜索“${source.keyword}”`;
    default: {
      const unhandled: never = source;
      throw new Error(`不认识的播放来源：${JSON.stringify(unhandled)}`);
    }
  }
};

export const lineIndexAt = (
  lines: readonly LyricLine[],
  at: number,
): number => {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lines[middle].start <= at) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
};

export const wordProgress = (word: LyricWord, at: number): number => {
  if (at <= word.start) return 0;
  if (at >= word.end) return 1;
  return (at - word.start) / (word.end - word.start);
};

export const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  loop: '列表循环',
  one: '单曲循环',
  shuffle: '随机播放',
};

export const NEXT_PLAY_MODE: Record<PlayMode, PlayMode> = {
  loop: 'one',
  one: 'shuffle',
  shuffle: 'loop',
};

export const noticeText = (notice: PlayerNotice): string => {
  switch (notice.kind) {
    case 'urlFailed':
      return `没取到播放地址：${failureText(notice.failure)}`;
    case 'streamFailed':
      return '音频没加载下来';
    case 'skipped':
      return `《${songTitle(notice.song)}》放不了，跳过了`;
    case 'nothingPlayable':
      return '播放队列里没有能放的歌';
    default: {
      const unhandled: never = notice;
      throw new Error(`不认识的播放提示：${JSON.stringify(unhandled)}`);
    }
  }
};
