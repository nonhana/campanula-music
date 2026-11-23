import { describe, expect, it, vi } from 'vitest';

import { haptic } from '#lib/components/shared/haptic.ts';

const media = (matches: Record<string, boolean>) => (query: string) => ({
  matches: Boolean(matches[query]),
});

describe('haptic', () => {
  it('触屏且未开启减少动态效果时触发短震动', () => {
    const vibrate = vi.fn(() => true);
    haptic(10, {
      matchMedia: media({ '(pointer: coarse)': true }),
      vibrate,
    });
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it('非触屏主指针或开启减少动态效果时不震动', () => {
    const desktopVibrate = vi.fn(() => true);
    haptic(10, {
      matchMedia: media({ '(pointer: coarse)': false }),
      vibrate: desktopVibrate,
    });
    expect(desktopVibrate).not.toHaveBeenCalled();

    const reducedVibrate = vi.fn(() => true);
    haptic(10, {
      matchMedia: media({
        '(pointer: coarse)': true,
        '(prefers-reduced-motion: reduce)': true,
      }),
      vibrate: reducedVibrate,
    });
    expect(reducedVibrate).not.toHaveBeenCalled();
  });

  it('缺少 vibrate 或 matchMedia 时静默跳过', () => {
    expect(() =>
      haptic(10, { matchMedia: media({ '(pointer: coarse)': true }) }),
    ).not.toThrow();
    expect(() => haptic(10, {})).not.toThrow();
    expect(() => haptic()).not.toThrow();
  });
});
