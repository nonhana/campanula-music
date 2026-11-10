<!-- 从不写滚动位置：只有听众拖滑块、点空白处才写
     放进滚动区域时它得是第一个子元素、区域自己不要留内边距，不然会离开边上；或者传 target 放在区域外的同一个定位盒里 -->
<script module lang="ts">
  import { MediaQuery } from 'svelte/reactivity';

  // 只用 coarse：混合输入设备上手指在右边上下滑仍要滚页面
  const coarsePointer = new MediaQuery('pointer: coarse');
</script>

<script lang="ts">
  import { untrack } from 'svelte';

  import { clamp } from '../shared/clamp';
  import { scrollBehavior } from '../shared/motion';
  import { DELAYS } from '../shared/motion-tokens';
  import { attachGrip, attachTouchClaim } from '../shared/press';
  import type { ScrollLookup, ScrollMark } from '../shared/scroll-marks';
  import { createSliderCore } from '../shared/slider-core';
  import { getSelectionMode, hasSelectionMode } from './selection-mode';

  interface Props {
    page?: { top: string; bottom: string };
    // 滚的是它，滚动条放在它外面（默认是父元素）
    target?: HTMLElement;
    axis?: 'x' | 'y';
    lookup?: ScrollLookup;
  }

  const { page, target, axis = 'y', lookup }: Props = $props();
  const selectionMode = hasSelectionMode() ? getSelectionMode() : undefined;
  const yielding = $derived(selectionMode?.() ?? false);

  // 这几个要和样式里的数一致：贴边 16px（w-4 / h-4）、滑块离边 2px、触屏那一块 44px 宽
  const ZONE = 16;
  const INSET = 2;
  const MIN_THUMB = 32;
  const LONG_PAGES = 4;
  const GRIP_SLOP = 12;

  let host = $state<HTMLElement>();
  let strip = $state<HTMLElement>();
  let grip = $state<HTMLElement>();
  let stripWidth = $state(0);
  let stripHeight = $state(0);
  let metrics = $state({
    position: 0,
    viewport: 0,
    content: 0,
    cross: 0,
  });
  let awake = $state(false);
  let near = $state(false);
  let dragging = $state(false);
  let quick = $state(false);
  let mark = $state<ScrollMark | null>(null);
  let bubbleHeight = $state(0);
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  let dragStart = { from: 0, start: 0 };
  // 按下那一次 onValue 不回写位置（基线 grab 也不写）
  let starting = false;

  const onPage = $derived(page !== undefined);
  const length = $derived(axis === 'y' ? stripHeight : stripWidth);
  const range = $derived(Math.max(0, metrics.content - metrics.viewport));
  const scrollable = $derived(range >= 1);
  const track = $derived(Math.max(0, length - 2 * INSET));
  const thumb = $derived(
    scrollable
      ? Math.min(
          track,
          Math.max(MIN_THUMB, (track * metrics.viewport) / metrics.content),
        )
      : 0,
  );
  const offset = $derived(
    range > 0 ? (track - thumb) * clamp(metrics.position / range, 0, 1) : 0,
  );
  const shown = $derived(scrollable && (awake || near || dragging));
  const thick = $derived(near || dragging);
  const grabbable = $derived(
    axis === 'y' &&
      scrollable &&
      metrics.content > LONG_PAGES * metrics.viewport &&
      (awake || dragging) &&
      !yielding &&
      coarsePointer.current,
  );
  const gripTop = $derived(Math.max(0, INSET + offset - GRIP_SLOP));
  const gripBottom = $derived(
    Math.min(length, INSET + offset + thumb + GRIP_SLOP),
  );
  const bubbleCenter = $derived(
    Math.min(
      Math.max(INSET + offset + thumb / 2, bubbleHeight / 2),
      length - bubbleHeight / 2,
    ),
  );

  const scroller = (): HTMLElement | null =>
    onPage ? document.documentElement : (target ?? host?.parentElement ?? null);

  const measure = () => {
    const el = scroller();
    if (!el) return;
    metrics =
      axis === 'y'
        ? {
            position: el.scrollTop,
            viewport: onPage ? window.innerHeight : el.clientHeight,
            content: el.scrollHeight,
            cross: el.clientWidth,
          }
        : {
            position: el.scrollLeft,
            viewport: el.clientWidth,
            content: el.scrollWidth,
            cross: el.clientHeight,
          };
    readMark();
  };

  const readMark = () => {
    if (quick && dragging && strip)
      mark = lookup?.markAt?.(strip.getBoundingClientRect().top) ?? null;
  };

  const linger = () => {
    awake = true;
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => (awake = false), DELAYS.scrollbar);
  };

  $effect(() => {
    const el = scroller();
    if (!el) return;
    const source = onPage ? window : el;
    const onscroll = () => {
      measure();
      linger();
    };
    const sizes = new ResizeObserver(measure);
    sizes.observe(el);
    for (const child of onPage ? [] : el.children) sizes.observe(child);
    const children = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach(
          (node) => node instanceof Element && sizes.observe(node),
        );
        record.removedNodes.forEach(
          (node) => node instanceof Element && sizes.unobserve(node),
        );
      }
    });
    if (!onPage) children.observe(el, { childList: true });
    source.addEventListener('scroll', onscroll, { passive: true });
    window.addEventListener('resize', measure);
    // 不 untrack 的话 measure 读到拖动状态，按下时会重装监听、把拖动清掉
    untrack(measure);
    return () => {
      sizes.disconnect();
      children.disconnect();
      source.removeEventListener('scroll', onscroll);
      window.removeEventListener('resize', measure);
      clearTimeout(fadeTimer);
      awake = false;
    };
  });

  const along = (sample: { x: number; y: number }): number =>
    axis === 'y' ? sample.y : sample.x;

  // 唯一写滚动位置的地方：别在滚动监听里调
  const moveTo = (position: number, behavior: ScrollBehavior) => {
    scroller()?.scrollTo(
      axis === 'y' ? { top: position, behavior } : { left: position, behavior },
    );
  };

  // 指针怎么接（捕获、断了、作废）由 attachGrip / attachTouchClaim 统一做，这里只把移动换成滚动位置
  const core = createSliderCore({
    begin(sample) {
      if (!scrollable || !strip) return null;
      // attachTouchClaim 交接过来的样本 target 是 .grip
      const onGrip = sample.target === grip;
      if (!onGrip) {
        // 触屏只认 .grip，落在细条上交给浏览器滚动
        if (sample.pointerType === 'touch') return null;
        const rect = strip.getBoundingClientRect();
        const at =
          along(sample) - (axis === 'y' ? rect.top : rect.left) - INSET;
        if (at < offset || at > offset + thumb) {
          moveTo(
            metrics.position + (at < offset ? -length : length),
            scrollBehavior(),
          );
          return null;
        }
      }
      dragStart = {
        from: along(sample),
        start: metrics.position,
      };
      starting = true;
      quick = onGrip;
      if (quick && sample.pointerType === 'touch') {
        navigator.vibrate?.(10);
      }
      return range > 0 ? metrics.position / range : 0;
    },
    track(sample) {
      const free = track - thumb;
      // 滑块占满轨道时没有拖的余地：停在原地，别滚到顶
      if (free <= 0 || range <= 0) return metrics.position / Math.max(1, range);
      return (
        (dragStart.start + ((along(sample) - dragStart.from) * range) / free) /
        range
      );
    },
    commit: () => {},
    cancel: () => {},
    onValue(value) {
      dragging = value !== null;
      if (value !== null) {
        if (!starting) {
          const next = value * range;
          if (Math.abs(next - metrics.position) > 0.5) moveTo(next, 'auto');
        }
        starting = false;
        readMark();
      } else {
        starting = false;
        quick = false;
        linger();
      }
    },
  });
  // 不写 touch-action：混合输入设备上手指落在右侧 16px 仍要能滚页面
  const gripAttach = attachGrip(core, { touchAction: false });
  const touchClaim = attachTouchClaim(core);
</script>

{#snippet bar()}
  <div
    bind:this={strip}
    bind:clientWidth={stripWidth}
    bind:clientHeight={stripHeight}
    class={[
      'scrollbar',
      axis,
      page
        ? 'fixed right-0 z-35 w-4'
        : axis === 'y'
          ? 'absolute right-0 top-0 w-4'
          : 'absolute left-0 h-4',
      scrollable && 'live',
      shown && 'shown',
      thick && 'thick',
    ]}
    style:top={page?.top ??
      (axis === 'x' ? `${metrics.cross - ZONE}px` : undefined)}
    style:bottom={page?.bottom}
    style:height={!page && axis === 'y' ? `${metrics.viewport}px` : undefined}
    style:width={axis === 'x' ? `${metrics.viewport}px` : undefined}
    aria-hidden={page ? 'true' : undefined}
    {@attach gripAttach}
    onpointerenter={(event) => (near = event.pointerType !== 'touch')}
    onpointerleave={() => {
      near = false;
      linger();
    }}
    onmousedown={(event) => event.preventDefault()}
  >
    <div
      class={['thumb', thick ? 'bg-primary-800' : 'bg-neutral-500/45']}
      style:height={axis === 'y' ? `${thumb}px` : undefined}
      style:width={axis === 'x' ? `${thumb}px` : undefined}
      style:transform={axis === 'y'
        ? `translateY(${offset}px)`
        : `translateX(${offset}px)`}
    ></div>
    {#if axis === 'y'}
      <div
        bind:this={grip}
        class="grip"
        style:top="{gripTop}px"
        style:height="{gripBottom - gripTop}px"
        {@attach grabbable && touchClaim}
      ></div>
    {/if}
    {#if lookup && axis === 'y'}
      <!-- 一直挂着（透明），第一次淡入才不是凭空冒出来 -->
      <div
        class={[
          'bubble rounded-xl bg-white px-3.5 py-2 shadow-float',
          dragging && quick && mark && 'open',
        ]}
        style:top="{bubbleCenter}px"
        bind:offsetHeight={bubbleHeight}
      >
        {#if mark}
          <span class="block text-caption text-neutral-600 tabular-nums"
            >{mark.caption}</span
          >
          <span
            class="block truncate text-label text-neutral-900 font-500"
            lang={mark.lang}>{mark.title}</span
          >
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

{#if page}
  {@render bar()}
{:else}
  <div
    bind:this={host}
    class={target
      ? 'absolute inset-x-0 top-0 z-1 h-0'
      : 'sticky left-0 top-0 z-1 h-0'}
    aria-hidden="true"
    data-scrollbar
  >
    {@render bar()}
  </div>
{/if}

<style>
  .scrollbar {
    pointer-events: none;
    cursor: default;
    user-select: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .scrollbar.live {
      pointer-events: auto;
    }
  }

  /* 离两头的 2px 要和脚本里的 INSET 一致 */
  .thumb {
    position: absolute;
    border-radius: 9999px;
    opacity: 0;
  }

  .y .thumb {
    top: 2px;
    right: 2px;
    width: 4px;
    transition:
      opacity var(--duration-state) var(--ease-in-soft),
      background-color var(--duration-feedback) var(--ease-out-soft),
      width var(--move-feedback) var(--ease-out-soft);
  }

  .x .thumb {
    bottom: 2px;
    left: 2px;
    height: 4px;
    transition:
      opacity var(--duration-state) var(--ease-in-soft),
      background-color var(--duration-feedback) var(--ease-out-soft),
      height var(--move-feedback) var(--ease-out-soft);
  }

  .y.thick .thumb {
    width: 8px;
  }

  .x.thick .thumb {
    height: 8px;
  }

  .shown .thumb {
    opacity: 1;
    transition-duration:
      var(--duration-feedback), var(--duration-feedback), var(--move-feedback);
    transition-timing-function: var(--ease-out-soft);
  }

  .grip {
    position: absolute;
    right: 0;
    width: 44px;
    pointer-events: none;
  }

  /* 让开按着滑块的那根手指 */
  .bubble {
    position: absolute;
    right: 56px;
    width: max-content;
    max-width: min(240px, calc(100vw - 96px));
    pointer-events: none;
    opacity: 0;
    transform: translateY(-50%);
    transition: opacity var(--duration-feedback) var(--ease-in-soft);
  }

  .bubble.open {
    opacity: 1;
    transition-timing-function: var(--ease-out-soft);
  }
</style>
