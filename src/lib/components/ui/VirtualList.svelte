<!-- keep 让被拖的行一直挂载：Android 上手指底下的元素不能卸载 -->
<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';

  import type { ScrollMark } from '../shared/scroll-marks';
  import { getScrollLookup, hasScrollLookup } from '../shared/scroll-marks';

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
    /** 变了就重新量一次可见范围 */
    remeasure?: unknown;
  }

  const {
    items,
    itemHeight,
    overscan = 8,
    scrollParent,
    getKey,
    row,
    markOf,
    placeOf,
    keep,
    animatePlace = false,
    hidden,
    remeasure,
  }: Props = $props();
  const lookup = hasScrollLookup() ? getScrollLookup() : null;

  let host = $state<HTMLElement>();
  let range = $state({ start: 0, end: 0 });

  const slots = $derived(items.length);

  const measure = () => {
    if (!host) return;
    const viewport = scrollParent
      ? {
          top: scrollParent.getBoundingClientRect().top,
          height: scrollParent.clientHeight,
        }
      : { top: 0, height: window.innerHeight };
    const viewTop = viewport.top - host.getBoundingClientRect().top;
    const start = Math.max(0, Math.floor(viewTop / itemHeight) - overscan);
    const end = Math.min(
      slots,
      Math.ceil((viewTop + viewport.height) / itemHeight) + overscan,
    );
    if (start !== range.start || end !== range.end) range = { start, end };
  };

  $effect(() => {
    // 让列表长度、remeasure 也进依赖
    void items.length;
    void slots;
    void remeasure;
    measure();
  });

  $effect(() => {
    const scroller = scrollParent ?? window;
    scroller.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      scroller.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
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

  const visible = $derived.by(() => {
    const out: { item: T; index: number }[] = [];
    for (let i = 0; i < items.length; i += 1) {
      // 拖动时 items 是原顺序，挂不挂载看 placeOf 的视觉位置；只按 index 会卸掉正需要的行
      const slot = Math.floor(
        (placeOf?.(items[i]!, i) ?? i * itemHeight) / itemHeight,
      );
      if (
        (slot >= range.start && slot < Math.min(range.end, items.length)) ||
        keep?.(items[i]!, i)
      )
        out.push({ item: items[i]!, index: i });
    }
    return out;
  });
</script>

<div
  bind:this={host}
  class="relative"
  style:height="{slots * itemHeight}px"
  data-reveal-group
>
  {#each visible as { item, index } (getKey(item, index))}
    <div
      class={['absolute inset-x-0', animatePlace && 'drag-move']}
      style:transform="translateY({placeOf?.(item, index) ??
        index * itemHeight}px)"
      style:height="{itemHeight}px"
      style:opacity={hidden?.(item, index) ? '0' : undefined}
    >
      {@render row(item, index)}
    </div>
  {/each}
</div>

<style>
  .drag-move {
    transition:
      transform var(--move-state) var(--ease-out-soft),
      opacity var(--duration-state) var(--ease-out-soft);
  }
</style>
