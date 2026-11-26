import { describe, expect, it } from 'vitest';

import {
  collectRangeIndices,
  computeVirtualRange,
  EMPTY_VIRTUAL_POOL,
  INITIAL_SCROLL_MOTION,
  reconcileVirtualSlots,
  sortVirtualSlots,
  stepScrollMotion,
} from '../../src/lib/components/ui/virtual-list-core.ts';

describe('computeVirtualRange', () => {
  it('空列表或非法行高返回空范围', () => {
    expect(
      computeVirtualRange({
        viewTop: 0,
        viewportHeight: 600,
        itemHeight: 56,
        count: 0,
        overscan: 10,
        direction: 0,
        fast: false,
      }),
    ).toEqual({ start: 0, end: 0 });
  });

  it('静止态在视口上下对称留出 overscan 并夹在总条数内', () => {
    expect(
      computeVirtualRange({
        viewTop: 560,
        viewportHeight: 560,
        itemHeight: 56,
        count: 100,
        overscan: 10,
        direction: 0,
        fast: false,
      }),
    ).toEqual({ start: 0, end: 30 });
  });

  it('向下滚动把缓冲偏向下方，向上滚动把缓冲偏向上方', () => {
    const down = computeVirtualRange({
      viewTop: 5600,
      viewportHeight: 560,
      itemHeight: 56,
      count: 500,
      overscan: 10,
      direction: 1,
      fast: false,
    });
    const up = computeVirtualRange({
      viewTop: 5600,
      viewportHeight: 560,
      itemHeight: 56,
      count: 500,
      overscan: 10,
      direction: -1,
      fast: false,
    });
    expect(down).toEqual({ start: 95, end: 128 });
    expect(up).toEqual({ start: 82, end: 115 });
  });

  it('高速甩滑时按速度动态扩大前向缓冲并压缩后向缓冲', () => {
    const fast = computeVirtualRange({
      viewTop: 5600,
      viewportHeight: 560,
      itemHeight: 56,
      count: 500,
      overscan: 10,
      direction: -1,
      fast: true,
      velocity: -45,
    });
    expect(fast).toEqual({ start: 59, end: 112 });
  });
});

describe('reconcileVirtualSlots', () => {
  it('原地覆写失效槽位，保持槽位顺序恒定、零节点重排', () => {
    const first = reconcileVirtualSlots(
      EMPTY_VIRTUAL_POOL,
      collectRangeIndices({ start: 0, end: 5 }, 100),
    );
    expect(first.slots.map((entry) => entry.slot)).toEqual([0, 1, 2, 3, 4]);
    expect(first.slots.map((entry) => entry.index)).toEqual([0, 1, 2, 3, 4]);

    const next = reconcileVirtualSlots(
      first,
      collectRangeIndices({ start: 2, end: 7 }, 100),
    );
    // 槽位 ID 顺序与数组位置完全不变，避免 DOM insertBefore
    expect(next.slots.map((entry) => entry.slot)).toEqual([0, 1, 2, 3, 4]);
    expect(next.slots.map((entry) => entry.index)).toEqual([5, 6, 2, 3, 4]);
    expect(next.nextSlot).toBe(5);
  });

  it('大跨度高速跳转时原地复用全部槽位且不倒序翻转', () => {
    const first = reconcileVirtualSlots(
      EMPTY_VIRTUAL_POOL,
      collectRangeIndices({ start: 0, end: 6 }, 5000),
    );
    const jumped = reconcileVirtualSlots(
      first,
      collectRangeIndices({ start: 2000, end: 2006 }, 5000),
    );
    expect(jumped.slots.map((entry) => entry.slot)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(jumped.slots.map((entry) => entry.index)).toEqual([
      2000, 2001, 2002, 2003, 2004, 2005,
    ]);
    expect(jumped.nextSlot).toBe(6);
  });

  it('列表重排时按键保留原槽位，避免键盘排序丢失焦点或替换行实例', () => {
    const before = ['a', 'b', 'c', 'd'];
    const first = reconcileVirtualSlots(
      EMPTY_VIRTUAL_POOL,
      [0, 1, 2, 3],
      (index) => before[index]!,
    );
    const slotA = first.slots.find((entry) => entry.key === 'a')!.slot;
    const slotB = first.slots.find((entry) => entry.key === 'b')!.slot;

    const after = ['b', 'a', 'c', 'd'];
    const reordered = reconcileVirtualSlots(
      first,
      [0, 1, 2, 3],
      (index) => after[index]!,
    );
    expect(reordered.slots.find((entry) => entry.key === 'a')).toEqual({
      slot: slotA,
      index: 1,
      key: 'a',
    });
    expect(reordered.slots.find((entry) => entry.key === 'b')).toEqual({
      slot: slotB,
      index: 0,
      key: 'b',
    });
    expect(reordered.nextSlot).toBe(first.nextSlot);
    expect(
      reconcileVirtualSlots(reordered, [0, 1, 2, 3], (index) => after[index]!),
    ).toBe(reordered);
  });

  it('钉住聚焦行：聚焦行滚出视口后仍保留原槽位，其余槽位正常复用', () => {
    const first = reconcileVirtualSlots(
      EMPTY_VIRTUAL_POOL,
      collectRangeIndices({ start: 10, end: 14 }, 100, 11),
    );
    const pinnedSlot = first.slots.find((entry) => entry.index === 11)!.slot;
    const scrolled = reconcileVirtualSlots(
      first,
      collectRangeIndices({ start: 30, end: 34 }, 100, 11),
    );
    expect(scrolled.slots.find((entry) => entry.index === 11)?.slot).toBe(
      pinnedSlot,
    );
    expect(
      scrolled.slots.map((entry) => entry.index).sort((a, b) => a - b),
    ).toEqual([11, 30, 31, 32, 33]);
  });

  it('列表缩短时裁掉越界槽位，不留悬空索引', () => {
    const first = reconcileVirtualSlots(
      EMPTY_VIRTUAL_POOL,
      collectRangeIndices({ start: 0, end: 6 }, 10),
    );
    const shrunk = reconcileVirtualSlots(
      first,
      collectRangeIndices({ start: 0, end: 10 }, 3),
    );
    expect(shrunk.slots.map((entry) => entry.index)).toEqual([0, 1, 2]);
  });

  it('sortVirtualSlots 仅在乱序时按索引升序重排，已有序返回原引用', () => {
    const first = reconcileVirtualSlots(
      EMPTY_VIRTUAL_POOL,
      collectRangeIndices({ start: 0, end: 4 }, 100),
    );
    expect(sortVirtualSlots(first)).toBe(first);
    const scrolled = reconcileVirtualSlots(
      first,
      collectRangeIndices({ start: 2, end: 6 }, 100),
    );
    expect(scrolled.slots.map((entry) => entry.index)).toEqual([4, 5, 2, 3]);
    expect(
      sortVirtualSlots(scrolled).slots.map((entry) => entry.index),
    ).toEqual([2, 3, 4, 5]);
  });
});

describe('stepScrollMotion', () => {
  it('单次瞬跳不误触发高速延后拉图，连续两帧高速滚动才开启', () => {
    const t0 = stepScrollMotion(INITIAL_SCROLL_MOTION, 0, 100);
    expect(t0.deferImages).toBe(false);
    const jump = stepScrollMotion(t0, 4000, 116);
    expect(jump.fastStreak).toBe(1);
    expect(jump.deferImages).toBe(false);
    const fast2 = stepScrollMotion(jump, 4200, 132);
    expect(fast2.fastStreak).toBe(2);
    expect(fast2.deferImages).toBe(true);
    expect(fast2.velocity).toBeGreaterThan(10);
    const slow = stepScrollMotion(fast2, 4210, 148);
    expect(slow.deferImages).toBe(false);
  });
});
