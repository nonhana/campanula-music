import { describe, expect, it } from 'vitest';

import type { Song } from '#lib/api/library.ts';
import type { LyricLine } from '#lib/api/playback.ts';
import type { LibraryState } from '#lib/app/library.ts';
import type { PlayerState } from '#lib/app/player.ts';
import {
  formatSeconds,
  lineIndexAt,
  neighborSong,
  NEXT_PLAY_MODE,
  noticeText,
  PLAY_MODE_LABEL,
  QUEUE_PANEL_ID,
  queueEmpty,
  sourceName,
  turnOf,
  wordProgress,
} from '#lib/components/player/view.ts';

const songOf = (id: number, name: string): Song =>
  ({ id, name, artists: [] }) as unknown as Song;

describe('player/view', () => {
  it('判断队列空状态、相邻曲目、换歌方向与时间格式', () => {
    expect(QUEUE_PANEL_ID).toBe('queue-panel');
    const a = songOf(1, '第一首');
    const b = songOf(2, '第二首');
    const empty = {
      queue: [],
      neighbors: { previous: null, next: null },
    } as unknown as PlayerState;
    expect(queueEmpty(empty)).toBe(true);
    expect(neighborSong(empty, 'previous')).toBeNull();

    const filled = {
      queue: [
        { song: a, source: { kind: 'daily' } },
        { song: b, source: { kind: 'daily' } },
      ],
      neighbors: { previous: 0, next: 1 },
    } as unknown as PlayerState;
    expect(queueEmpty(filled)).toBe(false);
    expect(neighborSong(filled, 'previous')).toBe(a);
    expect(neighborSong(filled, 'next')).toBe(b);

    expect(turnOf(null)).toBeNull();
    expect(turnOf('next')).toBe('left');
    expect(turnOf('pick')).toBe('left');
    expect(turnOf('previous')).toBe('right');
    expect(() => turnOf('other' as never)).toThrow('不认识的换歌原因');

    expect(formatSeconds(125)).toBe('2:05');
    expect(PLAY_MODE_LABEL.loop).toBe('列表循环');
    expect(NEXT_PLAY_MODE.shuffle).toBe('loop');
  });

  it('按播放来源解析标题并在缺失时安全返回 null', () => {
    expect(sourceName(null, { kind: 'downloads' })).toBe('已下载');
    expect(sourceName(null, { kind: 'daily' })).toBeNull();

    const library = {
      playlists: [{ id: 1, name: '我的歌单', kind: 'own' }],
      albums: [{ id: 10, name: '备选专辑' }],
      artists: [{ id: 20, name: '备选歌手' }],
      albumPage: (id: number) =>
        id === 11
          ? { status: 'shown', content: { album: { name: '详情专辑' } } }
          : null,
      artistPage: (id: number) =>
        id === 21
          ? { status: 'shown', content: { artist: { name: '详情歌手' } } }
          : null,
    } as unknown as LibraryState;

    expect(sourceName(library, { kind: 'playlist', id: 1 })).toBe('我的歌单');
    expect(sourceName(library, { kind: 'playlist', id: 9 })).toBeNull();
    expect(sourceName(library, { kind: 'album', id: 11 })).toBe('详情专辑');
    expect(sourceName(library, { kind: 'album', id: 10 })).toBe('备选专辑');
    expect(sourceName(library, { kind: 'album', id: 12 })).toBeNull();
    expect(sourceName(library, { kind: 'artist', id: 21 })).toBe('详情歌手');
    expect(sourceName(library, { kind: 'artist', id: 20 })).toBe('备选歌手');
    expect(sourceName(library, { kind: 'artist', id: 22 })).toBeNull();
    expect(sourceName(library, { kind: 'daily' })).toBe('每日推荐');
    expect(sourceName(library, { kind: 'search', keyword: '晴天' })).toBe(
      '搜索“晴天”',
    );
    expect(() => sourceName(library, { kind: 'other' } as never)).toThrow(
      '不认识的播放来源',
    );
  });

  it('二分定位当前歌词行、逐字进度与播放异常提示', () => {
    const line = (start: number, text: string): LyricLine => ({
      start,
      text,
      words: null,
      translation: null,
      romanization: null,
    });
    const lines: LyricLine[] = [
      line(1000, 'a'),
      line(3000, 'b'),
      line(5000, 'c'),
    ];
    expect(lineIndexAt(lines, 500)).toBe(-1);
    expect(lineIndexAt(lines, 1000)).toBe(0);
    expect(lineIndexAt(lines, 4200)).toBe(1);
    expect(lineIndexAt(lines, 9000)).toBe(2);

    const word = { start: 100, end: 300, text: '字' };
    expect(wordProgress(word, 50)).toBe(0);
    expect(wordProgress(word, 200)).toBe(0.5);
    expect(wordProgress(word, 400)).toBe(1);

    expect(
      noticeText({ kind: 'urlFailed', failure: { kind: 'offline' } }),
    ).toContain('没取到播放地址：');
    expect(noticeText({ kind: 'streamFailed' })).toBe('音频没加载下来');
    expect(noticeText({ kind: 'skipped', song: songOf(3, '晴天') })).toBe(
      '《晴天》放不了，跳过了',
    );
    expect(noticeText({ kind: 'nothingPlayable' })).toBe(
      '播放队列里没有能放的歌',
    );
    expect(() => noticeText({ kind: 'other' } as never)).toThrow(
      '不认识的播放提示',
    );
  });
});
