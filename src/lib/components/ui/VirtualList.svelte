<!-- keep 让被拖的行一直挂载：Android 上手指底下的元素不能卸载 -->
<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';

  import { atOnce } from '../shared/motion.ts';
  import type { ScrollMark } from '../shared/scroll-marks.ts';
  import { getScrollLookup, hasScrollLookup } from '../shared/scroll-marks.ts';
  import { setVirtualList } from './virtual-list-context.ts';
  import type {
    ScrollMotionState,
    VirtualPool,
    VirtualRange,
  } from './virtual-list-core.ts';
  import {
    collectRangeIndices,
    computeVirtualRange,
    EMPTY_VIRTUAL_POOL,
    INITIAL_SCROLL_MOTION,
    reconcileVirtualSlots,
    sortVirtualSlots,
    stepScrollMotion,
  } from './virtual-list-core.ts';

  const FAST_SETTLE_DELAY = 120;

  interface Props {
    items: readonly T[];
    itemHeight: number;
    overscan?: number;
    scrollParent?: HTMLElement;
    getKey: (item: T, index: number) => string | number;
    row: Snippet<[T, number]>;
    markOf?: (item: T, index: number) => ScrollMark;
    placeOf?: (item: T, index: number) => number;
    keep?: (item: T, index: number) => boolean;
    animatePlace?: boolean;
    hidden?: (item: T, index: number) => boolean;
    surface?: 'paper' | 'ground';
    /** 变了就重新量一次可见范围 */
    remeasure?: unknown;
  }

  const {
    items,
    itemHeight,
    overscan = 10,
    scrollParent,
    getKey,
    row,
    markOf,
    placeOf,
    keep,
    animatePlace = false,
    hidden,
    surface,
    remeasure,
  }: Props = $props();
  const lookup = hasScrollLookup() ? getScrollLookup() : null;

  let host = $state<HTMLElement>();
  let range = $state.raw<VirtualRange>({ start: 0, end: 0 });
  let pool = $state.raw<VirtualPool>(EMPTY_VIRTUAL_POOL);
  let deferImages = $state(false);

  setVirtualList({
    get deferImages() {
      return deferImages;
    },
  });

  const slots = $derived(items.length);

  let hostOffset = 0;
  let viewportHeight = 0;
  let motion: ScrollMotionState = INITIAL_SCROLL_MOTION;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const focusedIndex = (): number | null => {
    if (!host) return null;
    const active = document.activeElement;
    if (!(active instanceof Element) || !host.contains(active)) return null;
    // 只钉住键盘可见焦点，触屏点按后不把已滚远的行永久留在 DOM
    if (!active.matches(':focus-visible')) return null;
    let rowEl: Element | null = active;
    while (rowEl && rowEl.parentElement !== host) rowEl = rowEl.parentElement;
    if (!rowEl) return null;
    const childIndex = Array.prototype.indexOf.call(host.children, rowEl);
    if (childIndex < 0) return null;
    const entry = untrack(() => pool.slots[childIndex]);
    if (!entry) return null;
    if (
      entry.index < items.length &&
      getKey(items[entry.index]!, entry.index) === entry.key
    )
      return entry.index;
    const moved = items.findIndex(
      (item, index) => getKey(item, index) === entry.key,
    );
    return moved >= 0 ? moved : null;
  };

  const neededIndices = (
    next: VirtualRange,
    pinned: number | null,
  ): number[] => {
    if (!placeOf && !keep) return collectRangeIndices(next, slots, pinned);
    const start = Math.max(0, Math.min(slots, next.start));
    const end = Math.max(start, Math.min(slots, next.end));
    const out: number[] = [];
    for (let i = 0; i < slots; i += 1) {
      // 拖动时 items 是原顺序，挂不挂载看 placeOf 的视觉位置；只按 index 会卸掉正需要的行
      const slot = Math.floor(
        (placeOf?.(items[i]!, i) ?? i * itemHeight) / itemHeight,
      );
      if ((slot >= start && slot < end) || keep?.(items[i]!, i) || i === pinned)
        out.push(i);
    }
    return out;
  };

  const syncGeometry = () => {
    if (!host) return;
    if (scrollParent) {
      viewportHeight = scrollParent.clientHeight;
      hostOffset =
        host.getBoundingClientRect().top -
        scrollParent.getBoundingClientRect().top +
        scrollParent.scrollTop;
    } else {
      viewportHeight = window.innerHeight;
    }
  };

  const readViewTop = (): number => {
    if (!host) return 0;
    return scrollParent
      ? scrollParent.scrollTop - hostOffset
      : -host.getBoundingClientRect().top;
  };

  const readViewportHeight = (): number =>
    scrollParent
      ? viewportHeight || scrollParent.clientHeight
      : window.innerHeight;

  const applyRange = (flush: boolean, trackVelocity: boolean) => {
    if (!host) return;
    const viewTop = readViewTop();
    if (trackVelocity) {
      motion = stepScrollMotion(motion, viewTop, performance.now());
      if (motion.deferImages !== deferImages) deferImages = motion.deferImages;
      clearTimeout(settleTimer);
      if (motion.deferImages || motion.direction !== 0) {
        settleTimer = setTimeout(() => {
          motion = {
            ...motion,
            direction: 0,
            velocity: 0,
            fastStreak: 0,
            deferImages: false,
          };
          if (deferImages) deferImages = false;
          applyRange(false, false);
        }, FAST_SETTLE_DELAY);
      }
    }
    const next = computeVirtualRange({
      viewTop,
      viewportHeight: readViewportHeight(),
      itemHeight,
      count: slots,
      overscan,
      direction: motion.direction,
      fast: motion.deferImages,
      velocity: motion.velocity,
    });
    const currentRange = untrack(() => range);
    const currentPool = untrack(() => pool);
    const pinned = focusedIndex();
    const needed = neededIndices(next, pinned);
    const nextPool = reconcileVirtualSlots(currentPool, needed, (index) =>
      getKey(items[index]!, index),
    );
    const rangeChanged =
      next.start !== currentRange.start || next.end !== currentRange.end;
    if (!rangeChanged && nextPool === currentPool) return;
    // 滚动触发的槽位复用同步落盘且跳过行内局部过渡，避免旧行残影
    if (flush) {
      atOnce(() => {
        if (rangeChanged) range = next;
        if (nextPool !== currentPool) pool = nextPool;
      });
    } else {
      if (rangeChanged) range = next;
      if (nextPool !== currentPool) pool = nextPool;
    }
  };

  $effect.pre(() => {
    void items;
    void slots;
    void itemHeight;
    void overscan;
    void placeOf;
    void keep;
    if (!host) return;
    applyRange(false, false);
  });

  $effect(() => {
    void host;
    void scrollParent;
    void remeasure;
    void itemHeight;
    syncGeometry();
    applyRange(false, false);
  });

  $effect(() => {
    const scroller = scrollParent ?? window;
    // scroll 事件已按 vsync 节流，直接当帧同步落盘避免额外一帧滞后
    const onscroll = () => {
      applyRange(true, true);
    };
    const onresize = () => {
      syncGeometry();
      applyRange(false, false);
    };
    const onkeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || animatePlace) return;
      const currentPool = untrack(() => pool);
      const sorted = sortVirtualSlots(currentPool);
      if (sorted !== currentPool) pool = sorted;
    };
    const sizes = scrollParent ? new ResizeObserver(onresize) : null;
    if (scrollParent && sizes) sizes.observe(scrollParent);
    scroller.addEventListener('scroll', onscroll, { passive: true });
    window.addEventListener('resize', onresize);
    window.addEventListener('keydown', onkeydown, { capture: true });
    return () => {
      clearTimeout(settleTimer);
      sizes?.disconnect();
      scroller.removeEventListener('scroll', onscroll);
      window.removeEventListener('resize', onresize);
      window.removeEventListener('keydown', onkeydown, { capture: true });
    };
  });

  $effect(() => {
    if (!lookup || !markOf) return;
    const describe = markOf;
    const markAt = (top: number) => {
      if (!host || items.length === 0) return null;
      const index = Math.min(
        items.length - 1,
        Math.max(
          0,
          Math.floor((top - host.getBoundingClientRect().top) / itemHeight),
        ),
      );
      return describe(items[index], index);
    };
    lookup.markAt = markAt;
    return () => {
      if (lookup.markAt === markAt) lookup.markAt = null;
    };
  });

  const renderedSlots = $derived.by(() => {
    const out: { slot: number; item: T; index: number }[] = [];
    for (const entry of pool.slots) {
      if (entry.index < items.length)
        out.push({
          slot: entry.slot,
          item: items[entry.index]!,
          index: entry.index,
        });
    }
    return out;
  });
</script>

<div
  bind:this={host}
  class={[
    'virtual-host relative',
    surface === 'paper' && 'placeholder-paper',
    surface === 'ground' && 'placeholder-ground',
  ]}
  style:height="{slots * itemHeight}px"
  style:--row-h="{itemHeight}px"
  data-reveal-group
>
  {#each renderedSlots as { slot, item, index } (slot)}
    <div
      class={['absolute inset-x-0', animatePlace && 'drag-move']}
      style:top={placeOf ? undefined : `${index * itemHeight}px`}
      style:transform={placeOf
        ? `translateY(${placeOf(item, index)}px)`
        : undefined}
      style:height="{itemHeight}px"
      style:opacity={hidden?.(item, index) ? '0' : undefined}
    >
      {@render row(item, index)}
    </div>
  {/each}
</div>

<style>
  .virtual-host {
    isolation: isolate;
  }

  .virtual-host > div {
    contain: layout style;
  }

  /* 正在播放或淡出中的行抬到列表末尾绘制，避免行内动画合成层把下方普通行拆进新的 Overlap 层 */
  .virtual-host > div:has(:global(.wash), :global(.bars)) {
    z-index: 1;
  }

  .virtual-host.placeholder-paper {
    background: linear-gradient(
        to bottom,
        transparent 0 14px,
        theme('colors.primary.50') 14px 42px,
        transparent 42px 100%
      )
      16px 0 / calc(100% - 32px) var(--row-h) repeat-y;
  }

  .virtual-host.placeholder-paper > div {
    background: theme('colors.white');
  }

  .virtual-host.placeholder-ground {
    background: linear-gradient(
        to bottom,
        transparent 0 14px,
        theme('colors.primary.100') 14px 42px,
        transparent 42px 100%
      )
      16px 0 / calc(100% - 32px) var(--row-h) repeat-y;
  }

  .virtual-host.placeholder-ground > div {
    background: theme('colors.primary.50');
  }

  .drag-move {
    transition:
      transform var(--move-state) var(--ease-out-soft),
      opacity var(--duration-state) var(--ease-out-soft);
  }
</style>
