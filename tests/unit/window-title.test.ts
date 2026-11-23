import { describe, expect, it } from 'vitest';

import type { Song } from '#lib/api/library.ts';
import {
  createWindowTitle,
  formatPlayingTitle,
} from '#lib/components/shell/window-title.ts';

const sampleSong = (
  artists: Song['artists'],
): Pick<Song, 'name' | 'artists'> => ({
  name: '夜に駆ける',
  artists,
});

describe('window-title', () => {
  it('按曲目与歌手格式化播放标题且不含图标符号', () => {
    expect(formatPlayingTitle(sampleSong([{ id: 1, name: 'YOASOBI' }]))).toBe(
      '夜に駆ける · YOASOBI — Campanula',
    );
    expect(formatPlayingTitle(sampleSong([]))).toBe(
      '夜に駆ける · 未知歌手 — Campanula',
    );
  });

  it('播放中覆写窗口标题、换页时记住新路由标题并在暂停或销毁时精准还原', () => {
    let title = '曲库 · Campanula';
    let notify: (() => void) | undefined;

    const controller = createWindowTitle({
      readTitle: () => title,
      writeTitle: (next) => {
        title = next;
      },
      observeTitle: (onChange) => {
        notify = onChange;
        return () => {
          notify = undefined;
        };
      },
    });

    // 非播放态换页不覆写路由标题
    title = '设置 · Campanula';
    notify?.();
    expect(title).toBe('设置 · Campanula');

    // 开始播放后显示曲目标题
    controller.setPlaying('夜に駆ける · YOASOBI — Campanula');
    expect(title).toBe('夜に駆ける · YOASOBI — Campanula');

    // 播放中换页，路由写入新标题后记住新标题并保持播放标题
    title = '每日推荐 · Campanula';
    notify?.();
    expect(title).toBe('夜に駆ける · YOASOBI — Campanula');

    // 暂停时还原为最新路由标题（而非切歌前的旧页面）
    controller.setPlaying(null);
    expect(title).toBe('每日推荐 · Campanula');

    // 播放中销毁外框也还原路由标题
    controller.setPlaying('群青 · YOASOBI — Campanula');
    expect(title).toBe('群青 · YOASOBI — Campanula');
    controller.destroy();
    expect(title).toBe('每日推荐 · Campanula');
    expect(notify).toBeUndefined();
  });
});
