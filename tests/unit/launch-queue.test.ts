import { describe, expect, it, vi } from 'vitest';

import type { LaunchParamsLike } from '#lib/components/shell/launch-queue.ts';
import {
  consumeLaunchQueue,
  parseShortcutRoute,
} from '#lib/components/shell/launch-queue.ts';

const ORIGIN = 'https://music.example.test';

describe('launch-queue', () => {
  it('仅解析同源且带 shortcut 标记的白名单快捷路由', () => {
    expect(parseShortcutRoute(`${ORIGIN}/daily?source=shortcut`, ORIGIN)).toBe(
      '/daily',
    );
    expect(parseShortcutRoute(`${ORIGIN}/search?source=shortcut`, ORIGIN)).toBe(
      '/search',
    );
    expect(
      parseShortcutRoute(`${ORIGIN}/downloads?source=shortcut`, ORIGIN),
    ).toBe('/downloads');
    expect(
      parseShortcutRoute(`${ORIGIN}/playlists?source=shortcut`, ORIGIN),
    ).toBe('/playlists');

    expect(parseShortcutRoute(`${ORIGIN}/`, ORIGIN)).toBeNull();
    expect(parseShortcutRoute(`${ORIGIN}/daily`, ORIGIN)).toBeNull();
    expect(
      parseShortcutRoute(`${ORIGIN}/settings?source=shortcut`, ORIGIN),
    ).toBeNull();
    expect(
      parseShortcutRoute(
        'https://other.example.test/daily?source=shortcut',
        ORIGIN,
      ),
    ).toBeNull();
    expect(parseShortcutRoute(undefined, ORIGIN)).toBeNull();
    expect(parseShortcutRoute('http://[::1', ORIGIN)).toBeNull();
  });

  it('冷启动命中快捷地址时清理查询串，热启动调用导航，普通图标启动保持原地不动', () => {
    let consumer: ((params: LaunchParamsLike) => void) | undefined;
    let href = `${ORIGIN}/daily?source=shortcut`;
    const navigate = vi.fn();
    const cleanCurrent = vi.fn();

    const stop = consumeLaunchQueue(
      { navigate, cleanCurrent },
      {
        launchQueue: {
          setConsumer(fn) {
            consumer = fn;
          },
        },
        currentURL: () => new URL(href),
      },
    );

    consumer?.({ targetURL: `${ORIGIN}/daily?source=shortcut` });
    expect(cleanCurrent).toHaveBeenCalledWith('/daily');
    expect(navigate).not.toHaveBeenCalled();

    href = `${ORIGIN}/daily`;
    consumer?.({ targetURL: `${ORIGIN}/` });
    expect(navigate).not.toHaveBeenCalled();

    consumer?.({ targetURL: `${ORIGIN}/downloads?source=shortcut` });
    expect(navigate).toHaveBeenCalledWith('/downloads');

    stop();
    consumer?.({ targetURL: `${ORIGIN}/search?source=shortcut` });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('没有 launchQueue 时静默返回空清理函数', () => {
    const navigate = vi.fn();
    const cleanCurrent = vi.fn();
    const stop = consumeLaunchQueue(
      { navigate, cleanCurrent },
      { currentURL: () => new URL(ORIGIN) },
    );
    expect(() => stop()).not.toThrow();
    expect(navigate).not.toHaveBeenCalled();
    expect(cleanCurrent).not.toHaveBeenCalled();
  });
});
