import { describe, expect, it, vi } from 'vitest';

import type { CloseWatcherLike } from '#lib/components/shell/exit-guard.ts';
import {
  createExitGuard,
  EXIT_CONFIRM_MS,
} from '#lib/components/shell/exit-guard.ts';

interface FakeWatcher {
  watcher: CloseWatcherLike;
  destroy: ReturnType<typeof vi.fn>;
  triggerClose: () => void;
}

const createFakeWatcher = (): FakeWatcher => {
  const listeners = new Set<() => void>();
  const destroy = vi.fn(() => {
    listeners.clear();
  });
  return {
    watcher: {
      destroy,
      addEventListener: (_type, listener) => listeners.add(listener),
      removeEventListener: (_type, listener) => listeners.delete(listener),
    },
    destroy,
    triggerClose() {
      for (const listener of [...listeners]) listener();
    },
  };
};

describe('exit-guard', () => {
  it('首次返回触发轻震并展示二次确认，窗口期内不再布防，超时自动收起并重新布防', () => {
    const watchers: FakeWatcher[] = [];
    const scheduled: { ms: number; run: () => void; cancelled: boolean }[] = [];
    const states: boolean[] = [];
    const vibrate = vi.fn();

    const guard = createExitGuard((confirming) => states.push(confirming), {
      enabled: () => true,
      createWatcher: () => {
        const next = createFakeWatcher();
        watchers.push(next);
        return next.watcher;
      },
      visibilityState: () => 'visible',
      addVisibilityListener: () => {},
      removeVisibilityListener: () => {},
      addPageHideListener: () => {},
      removePageHideListener: () => {},
      after: (ms, callback) => {
        const entry = { ms, run: callback, cancelled: false };
        scheduled.push(entry);
        return () => {
          entry.cancelled = true;
        };
      },
      vibrate,
    });

    guard.setActive(true);
    expect(watchers).toHaveLength(1);

    watchers[0]!.triggerClose();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(states).toEqual([true]);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]!.ms).toBe(EXIT_CONFIRM_MS);
    // 2 秒二次确认窗口期间不再创建新 watcher，第二次返回直接放行退出
    guard.setActive(true);
    expect(watchers).toHaveLength(1);

    scheduled[0]!.run();
    expect(states).toEqual([true, false]);
    expect(watchers).toHaveLength(2);

    guard.destroy();
    expect(watchers[1]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('手动关闭提示、停用守卫与切后台/pagehide 均正确重置并按需重建', () => {
    const watchers: FakeWatcher[] = [];
    const visibilityListeners = new Set<() => void>();
    const pageHideListeners = new Set<() => void>();
    let visibility: DocumentVisibilityState = 'visible';
    let cancelCount = 0;
    const states: boolean[] = [];

    const guard = createExitGuard((confirming) => states.push(confirming), {
      enabled: () => true,
      createWatcher: () => {
        const next = createFakeWatcher();
        watchers.push(next);
        return next.watcher;
      },
      visibilityState: () => visibility,
      addVisibilityListener: (listener) => visibilityListeners.add(listener),
      removeVisibilityListener: (listener) =>
        visibilityListeners.delete(listener),
      addPageHideListener: (listener) => pageHideListeners.add(listener),
      removePageHideListener: (listener) => pageHideListeners.delete(listener),
      after: () => () => {
        cancelCount += 1;
      },
      vibrate: () => {},
    });

    guard.setActive(true);
    expect(watchers).toHaveLength(1);

    watchers[0]!.triggerClose();
    expect(states).toEqual([true]);

    // 手动关闭提示立刻撤销计时并重新布防
    guard.dismiss();
    expect(cancelCount).toBe(1);
    expect(states).toEqual([true, false]);
    expect(watchers).toHaveLength(2);

    // 切后台销毁 watcher，回前台重新布防
    visibility = 'hidden';
    for (const listener of visibilityListeners) listener();
    expect(watchers[1]!.destroy).toHaveBeenCalledTimes(1);

    visibility = 'visible';
    for (const listener of visibilityListeners) listener();
    expect(watchers).toHaveLength(3);

    // pagehide 也立即销毁 watcher
    for (const listener of pageHideListeners) listener();
    expect(watchers[2]!.destroy).toHaveBeenCalledTimes(1);

    // 停用后回前台不布防
    guard.setActive(false);
    for (const listener of visibilityListeners) listener();
    expect(watchers).toHaveLength(3);

    guard.destroy();
    expect(visibilityListeners.size).toBe(0);
    expect(pageHideListeners.size).toBe(0);
  });

  it('桌面精细指针或缺少 CloseWatcher 时不布防', () => {
    const createWatcher = vi.fn(() => createFakeWatcher().watcher);
    const desktopGuard = createExitGuard(() => {}, {
      enabled: () => false,
      createWatcher,
      visibilityState: () => 'visible',
      addVisibilityListener: () => {},
      removeVisibilityListener: () => {},
      addPageHideListener: () => {},
      removePageHideListener: () => {},
      after: () => () => {},
      vibrate: () => {},
    });
    desktopGuard.setActive(true);
    expect(createWatcher).not.toHaveBeenCalled();
    desktopGuard.destroy();

    const unsupported = createExitGuard(() => {}, {
      enabled: () => true,
      visibilityState: () => 'visible',
      addVisibilityListener: () => {},
      removeVisibilityListener: () => {},
      addPageHideListener: () => {},
      removePageHideListener: () => {},
      after: () => () => {},
      vibrate: () => {},
    });
    expect(() => {
      unsupported.setActive(true);
      unsupported.dismiss();
      unsupported.destroy();
    }).not.toThrow();
  });
});
