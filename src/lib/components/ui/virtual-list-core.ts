export type ScrollDirection = -1 | 0 | 1;

export interface VirtualRangeInput {
  viewTop: number;
  viewportHeight: number;
  itemHeight: number;
  count: number;
  overscan: number;
  direction: ScrollDirection;
  fast: boolean;
  velocity?: number;
}

export interface VirtualRange {
  readonly start: number;
  readonly end: number;
}

export interface VirtualSlot {
  readonly slot: number;
  readonly index: number;
  readonly key: string | number;
}

export interface VirtualPool {
  readonly slots: readonly VirtualSlot[];
  readonly nextSlot: number;
}

export interface ScrollMotionState {
  readonly top: number;
  readonly time: number;
  readonly direction: ScrollDirection;
  readonly velocity: number;
  readonly fastStreak: number;
  readonly deferImages: boolean;
}

export const EMPTY_VIRTUAL_POOL: VirtualPool = {
  slots: [],
  nextSlot: 0,
};

export const INITIAL_SCROLL_MOTION: ScrollMotionState = {
  top: 0,
  time: Number.NEGATIVE_INFINITY,
  direction: 0,
  velocity: 0,
  fastStreak: 0,
  deferImages: false,
};

const MIN_TRAILING = 4;
const FAST_TRAILING = 2;
const MIN_FAST_LEADING = 24;
const MAX_FAST_LEAD = 48;
const FAST_PREDICT_MS = 50;
const FAST_VELOCITY_PX_PER_MS = 2.5;
const FAST_MIN_DELTA_PX = 24;
const FAST_SAMPLE_FLOOR_MS = 8;
const FAST_STREAK_RESET_MS = 120;
const MAX_TRACKED_VELOCITY = 80;

export const computeVirtualRange = ({
  viewTop,
  viewportHeight,
  itemHeight,
  count,
  overscan,
  direction,
  fast,
  velocity = 0,
}: VirtualRangeInput): VirtualRange => {
  if (count <= 0 || itemHeight <= 0) return { start: 0, end: 0 };
  const visibleStart = Math.floor(viewTop / itemHeight);
  const visibleEnd = Math.ceil((viewTop + viewportHeight) / itemHeight);
  const trailing = fast
    ? FAST_TRAILING
    : Math.max(MIN_TRAILING, Math.floor(overscan / 2));
  const predictedLead = fast
    ? Math.min(
        MAX_FAST_LEAD,
        Math.ceil((Math.abs(velocity) * FAST_PREDICT_MS) / itemHeight),
      )
    : 0;
  const leading = fast
    ? Math.max(overscan * 2, MIN_FAST_LEADING, predictedLead)
    : Math.max(overscan, Math.ceil(overscan * 1.8));
  const before =
    direction === -1 ? leading : direction === 1 ? trailing : overscan;
  const after =
    direction === 1 ? leading : direction === -1 ? trailing : overscan;
  const start = Math.max(0, Math.min(count, visibleStart - before));
  const end = Math.max(start, Math.min(count, visibleEnd + after));
  return { start, end };
};

export const collectRangeIndices = (
  range: VirtualRange,
  count: number,
  pinnedIndex: number | null = null,
): number[] => {
  const start = Math.max(0, Math.min(count, range.start));
  const end = Math.max(start, Math.min(count, range.end));
  const pinned =
    pinnedIndex !== null && pinnedIndex >= 0 && pinnedIndex < count
      ? pinnedIndex
      : null;

  const needed: number[] = [];
  if (pinned !== null && pinned < start) needed.push(pinned);
  for (let index = start; index < end; index += 1) needed.push(index);
  if (pinned !== null && pinned >= end) needed.push(pinned);
  return needed;
};

export const reconcileVirtualSlots = (
  pool: VirtualPool,
  neededIndices: readonly number[],
  keyOf: (index: number) => string | number = (index) => index,
): VirtualPool => {
  const neededByKey = new Map<string | number, number>();
  const neededEntries: { index: number; key: string | number }[] = [];
  for (const index of neededIndices) {
    const key = keyOf(index);
    if (neededByKey.has(key)) continue;
    neededByKey.set(key, index);
    neededEntries.push({ index, key });
  }

  const keptKeys = new Set<string | number>();
  const freePositions: number[] = [];
  const nextSlots: (VirtualSlot | null)[] = pool.slots.map((entry, pos) => {
    const nextIndex = neededByKey.get(entry.key);
    if (nextIndex !== undefined && !keptKeys.has(entry.key)) {
      keptKeys.add(entry.key);
      return nextIndex === entry.index
        ? entry
        : { slot: entry.slot, index: nextIndex, key: entry.key };
    }
    freePositions.push(pos);
    return null;
  });

  const missing: { index: number; key: string | number }[] = [];
  for (const entry of neededEntries) {
    if (!keptKeys.has(entry.key)) missing.push(entry);
  }

  // 原地覆写空闲槽位以保持 DOM 子节点顺序恒定，避免滚动时触发 insertBefore 重排
  const reused = Math.min(freePositions.length, missing.length);
  for (let i = 0; i < reused; i += 1) {
    const pos = freePositions[i]!;
    const item = missing[i]!;
    nextSlots[pos] = {
      slot: pool.slots[pos]!.slot,
      index: item.index,
      key: item.key,
    };
  }

  let nextSlot = pool.nextSlot;
  for (let i = reused; i < missing.length; i += 1) {
    const item = missing[i]!;
    nextSlots.push({ slot: nextSlot++, index: item.index, key: item.key });
  }

  const slots: VirtualSlot[] = [];
  for (const entry of nextSlots) {
    if (entry !== null) slots.push(entry);
  }

  if (
    nextSlot === pool.nextSlot &&
    slots.length === pool.slots.length &&
    slots.every((entry, i) => entry === pool.slots[i])
  )
    return pool;

  return { slots, nextSlot };
};

export const sortVirtualSlots = (pool: VirtualPool): VirtualPool => {
  for (let i = 1; i < pool.slots.length; i += 1) {
    if (pool.slots[i]!.index < pool.slots[i - 1]!.index) {
      return {
        slots: [...pool.slots].sort((a, b) => a.index - b.index),
        nextSlot: pool.nextSlot,
      };
    }
  }
  return pool;
};

export const stepScrollMotion = (
  previous: ScrollMotionState,
  top: number,
  time: number,
): ScrollMotionState => {
  if (!Number.isFinite(previous.time)) {
    return {
      top,
      time,
      direction: 0,
      velocity: 0,
      fastStreak: 0,
      deferImages: false,
    };
  }
  const delta = top - previous.top;
  if (delta === 0) return { ...previous, time };
  const direction: ScrollDirection = delta > 0 ? 1 : -1;
  const elapsed = time - previous.time;
  const absDelta = Math.abs(delta);
  const rawVelocity = absDelta / Math.max(elapsed, FAST_SAMPLE_FLOOR_MS);
  const velocity = direction * Math.min(MAX_TRACKED_VELOCITY, rawVelocity);
  const fastSample =
    absDelta >= FAST_MIN_DELTA_PX && rawVelocity >= FAST_VELOCITY_PX_PER_MS;
  // 需要连续两帧高速滚动才延后拉图，避免初开列表一次性定位 scrollTop 误触发延迟
  const continued =
    elapsed <= FAST_STREAK_RESET_MS &&
    (previous.direction === 0 || previous.direction === direction);
  const fastStreak = fastSample ? (continued ? previous.fastStreak + 1 : 1) : 0;
  return {
    top,
    time,
    direction,
    velocity: continued ? velocity : 0,
    fastStreak,
    deferImages: previous.deferImages ? fastSample : fastStreak >= 2,
  };
};
