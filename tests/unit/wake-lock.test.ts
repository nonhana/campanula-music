import { describe, expect, it, vi } from 'vitest';

import type { WakeLockSentinelLike } from '#lib/components/player/wake-lock.ts';
import { createScreenWakeLock } from '#lib/components/player/wake-lock.ts';

const createSentinel = () => {
  const listeners = new Set<() => void>();
  const release = vi.fn(async () => {
    for (const listener of [...listeners]) listener();
  });
  const sentinel: WakeLockSentinelLike = {
    release,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
  return {
    sentinel,
    release,
    triggerRelease() {
      for (const listener of [...listeners]) listener();
    },
  };
};

const flush = () => Promise.resolve().then(() => Promise.resolve());

describe('wake-lock', () => {
  it('歌词播放时获取常亮锁，重复激活幂等，停用或销毁即释放', async () => {
    const first = createSentinel();
    const request = vi.fn(async () => first.sentinel);
    const visibilityListeners = new Set<() => void>();
    const lock = createScreenWakeLock({
      request,
      visibilityState: () => 'visible',
      addVisibilityListener: (listener) => visibilityListeners.add(listener),
      removeVisibilityListener: (listener) =>
        visibilityListeners.delete(listener),
    });

    lock.setActive(true);
    lock.setActive(true);
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    lock.setActive(false);
    expect(first.release).toHaveBeenCalledTimes(1);

    const second = createSentinel();
    request.mockResolvedValueOnce(second.sentinel);
    lock.setActive(true);
    await flush();
    expect(request).toHaveBeenCalledTimes(2);

    lock.destroy();
    expect(second.release).toHaveBeenCalledTimes(1);
    expect(visibilityListeners.size).toBe(0);
  });

  it('页面隐藏释放常亮锁，回到前台仍激活时自动重新获取', async () => {
    let visibility: DocumentVisibilityState = 'visible';
    const first = createSentinel();
    const second = createSentinel();
    const request = vi
      .fn<() => Promise<WakeLockSentinelLike>>()
      .mockResolvedValueOnce(first.sentinel)
      .mockResolvedValueOnce(second.sentinel);
    const listeners = new Set<() => void>();

    const lock = createScreenWakeLock({
      request,
      visibilityState: () => visibility,
      addVisibilityListener: (listener) => listeners.add(listener),
      removeVisibilityListener: (listener) => listeners.delete(listener),
    });

    lock.setActive(true);
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    visibility = 'hidden';
    for (const listener of listeners) listener();
    expect(first.release).toHaveBeenCalledTimes(1);

    visibility = 'visible';
    for (const listener of listeners) listener();
    await flush();
    expect(request).toHaveBeenCalledTimes(2);

    lock.destroy();
    expect(second.release).toHaveBeenCalledTimes(1);
  });

  it('异步申请尚未返回时被取消则立即释放，申请失败静默降级', async () => {
    let resolveRequest!: (value: WakeLockSentinelLike) => void;
    const request = vi.fn(
      () =>
        new Promise<WakeLockSentinelLike>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const lock = createScreenWakeLock({
      request,
      visibilityState: () => 'visible',
      addVisibilityListener: () => {},
      removeVisibilityListener: () => {},
    });

    lock.setActive(true);
    lock.setActive(false);

    const late = createSentinel();
    resolveRequest(late.sentinel);
    await flush();
    expect(late.release).toHaveBeenCalledTimes(1);

    request.mockRejectedValueOnce(new Error('NotAllowedError'));
    lock.setActive(true);
    await flush();
    expect(() => lock.destroy()).not.toThrow();
  });
});
