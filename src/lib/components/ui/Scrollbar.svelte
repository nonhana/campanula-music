<!--
  自绘滚动条（DESIGN.md Components · Scrollbar，ADR-0012）。系统滚动条一律隐藏（uno.config.ts），换成这一条：浮在内容上、不占宽度。
  平时 4px 石墨淡；鼠标移到贴边 16px 的那一条上、正在拖时加粗到 8px 茎绿。滚动时淡入，停下 1 秒后淡出；内容不比区域长时没有。
  拖滑块跟着手滚，点滑块前后的空白处往那边翻一屏。
  触屏：列表超过 4 屏、细条亮着时，按住滑块附近（44px 宽、上下各多 12px 的看不见的一块）能拖，快速定位；按轨道空白处不翻页。
  传了 lookup（歌曲列表）时，按住那一块拖着的时候滑块左边有气泡，写列表最上面那一项（scroll-marks.ts）。只做竖的
  只读滚动位置：除了听众拖滑块、点空白处，从不写；内容变长变短时只重新量，不动滚动位置、也不亮出来。
  滑块不进 Tab 顺序、读屏读不到，和系统滚动条一样：键盘照常由浏览器滚。

  两种放法：
  - 页面：传 page，贴着窗口右边，上下边避开顶栏、底栏；
  - 区域：放进滚动区域，当它的第一个子元素。它粘在区域看得见的那一块里，所以滚轮、触控板在它上面照样滚这个区域。
    竖的（axis 'y'）贴右边，横的（'x'）贴底边；区域自己不要有内边距（放到里面那层），不然它会离开边上。
-->
<script lang='ts'>
  import { untrack } from 'svelte'

  import { clamp } from '../shared/clamp'
  import { scrollBehavior } from '../shared/motion'
  import { DELAYS } from '../shared/motion-tokens'
  import { attachGrip } from '../shared/press'
  import type { ScrollLookup, ScrollMark } from '../shared/scroll-marks'
  import { createSliderCore } from '../shared/slider-core'
  import { getSelectionMode, hasSelectionMode } from './selection-mode'

  interface Props {
    /** 跟着页面（窗口）滚：上下边（CSS 长度）是顶栏下沿、底栏上沿。不传就跟着所在的滚动区域滚 */
    page?: { top: string, bottom: string }
    /** 滚动方向：竖的贴右边，横的贴底边 */
    axis?: 'x' | 'y'
    /** 滚动区域的主人创建的那一份：按住那一块拖的时候，气泡问它最上面是哪一项 */
    lookup?: ScrollLookup
  }

  const { page, axis = 'y', lookup }: Props = $props()
  /** 多选时右边的触屏把手让给歌曲行的拖动把手（#36）：状态由多选模块经 context 提供（#66） */
  const selectionMode = hasSelectionMode()
    ? getSelectionMode()
    : undefined
  const yielding = $derived(selectionMode?.() ?? false)

  /** 贴边能悬停、能点按的那一条有多宽（px），和下面的 w-4 / h-4 一致 */
  const ZONE = 16
  /** 滑块离边上、离两头各留多少（px），和样式里的 2px 一致 */
  const INSET = 2
  /** 滑块最短多长（px）：几千首的歌单也抓得住 */
  const MIN_THUMB = 32
  /** 内容要比看得见的高出几倍，触屏才能按住滑块拖（照 Android 系统列表的快速滚动） */
  const LONG_PAGES = 4
  /** 触屏能按的那一块比滑块上下各长多少（px）；宽度见样式里 .grip 的 44px */
  const GRIP_SLOP = 12

  let host = $state<HTMLElement>()
  let strip = $state<HTMLElement>()
  /** 触屏能按的那一块（只有竖的有） */
  let grip = $state<HTMLElement>()
  let stripWidth = $state(0)
  let stripHeight = $state(0)
  /** 沿滚动方向：滚到哪、看得见多长、内容多长；cross 是另一个方向看得见多长（横的那条要贴底边） */
  let metrics = $state({
    position: 0,
    viewport: 0,
    content: 0,
    cross: 0,
  })
  /** 刚滚过（还没停够 1 秒） */
  let awake = $state(false)
  /** 鼠标在贴边的那一条上 */
  let near = $state(false)
  /** 正在拖滑块 */
  let dragging = $state(false)
  /** 是不是按在触屏那一块上（快速定位，有气泡） */
  let quick = $state(false)
  /** 气泡里写的；松手后留着最后一次的，淡出时字不变 */
  let mark = $state<ScrollMark | null>(null)
  let bubbleHeight = $state(0)
  /** 停下 1 秒后淡出的计时器 */
  let fadeTimer: ReturnType<typeof setTimeout> | undefined
  /** 这次拖动从哪开始：指针沿滚动方向的位置、区域当时滚到哪 */
  let dragStart = { from: 0, start: 0 }
  /** 刚按下：第一次 onValue 不回写位置（基线 grab 也不写） */
  let starting = false

  /** 只看是不是页面那条：上下边变了（顶行变高、底栏出现）不用重装监听 */
  const onPage = $derived(page !== undefined)
  const length = $derived(axis === 'y'
    ? stripHeight
    : stripWidth)
  const range = $derived(Math.max(0, metrics.content - metrics.viewport))
  const scrollable = $derived(range >= 1)
  const track = $derived(Math.max(0, length - 2 * INSET))
  const thumb = $derived(scrollable
    ? Math.min(track, Math.max(MIN_THUMB, track * metrics.viewport / metrics.content))
    : 0)
  /** 滑块离轨道开头多远；回弹时滚动位置会超出两头，滑块停在头尾 */
  const offset = $derived(range > 0
    ? (track - thumb) * clamp(metrics.position / range, 0, 1)
    : 0)
  const shown = $derived(scrollable && (awake || near || dragging))
  const thick = $derived(near || dragging)
  /** 触屏这时能按住滑块：竖的、列表够长、细条亮着（拖着时一直算） */
  const grabbable = $derived(axis === 'y' && scrollable && metrics.content > LONG_PAGES * metrics.viewport && (awake || dragging) && !yielding)
  /** 能按的那一块：比滑块上下各长 12px，不伸出这一条 */
  const gripTop = $derived(Math.max(0, INSET + offset - GRIP_SLOP))
  const gripBottom = $derived(Math.min(length, INSET + offset + thumb + GRIP_SLOP))
  /** 气泡的中线对着滑块中间，碰到两头就停住 */
  const bubbleCenter = $derived(Math.min(Math.max(INSET + offset + thumb / 2, bubbleHeight / 2), length - bubbleHeight / 2))

  const scroller = (): HTMLElement | null => onPage
    ? document.documentElement
    : host?.parentElement ?? null

  const measure = () => {
    const el = scroller()
    if (!el)
      return
    metrics = axis === 'y'
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
      }
    readMark()
  }

  /** 按住那一块拖着时，问列表这一条上沿（看得见的最上面）是哪一项 */
  const readMark = () => {
    if (quick && dragging && strip)
      mark = lookup?.markAt?.(strip.getBoundingClientRect().top) ?? null
  }

  /** 亮出来，停够 1 秒再淡出 */
  const linger = () => {
    awake = true
    clearTimeout(fadeTimer)
    fadeTimer = setTimeout(() => (awake = false), DELAYS.scrollbar)
  }

  $effect(() => {
    const el = scroller()
    if (!el)
      return
    const source = onPage ? window : el
    const onscroll = () => {
      measure()
      linger()
    }
    // 内容变长变短（同步进来新的歌、展开简介）、区域变大变小：只重新量
    const sizes = new ResizeObserver(measure)
    sizes.observe(el)
    for (const child of onPage
      ? []
      : el.children)
      sizes.observe(child)
    const children = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach(node => node instanceof Element && sizes.observe(node))
        record.removedNodes.forEach(node => node instanceof Element && sizes.unobserve(node))
      }
    })
    if (!onPage)
      children.observe(el, { childList: true })
    source.addEventListener('scroll', onscroll, { passive: true })
    window.addEventListener('resize', measure)
    // 不让这次量把拖动状态也算成这里的依赖：按下时会重装监听、把拖动清掉
    untrack(measure)
    return () => {
      sizes.disconnect()
      children.disconnect()
      source.removeEventListener('scroll', onscroll)
      window.removeEventListener('resize', measure)
      clearTimeout(fadeTimer)
      awake = false
    // 卸载时 attachGrip 自己作废这次按住
    }
  })

  /** 指针沿滚动方向的位置 */
  const along = (sample: { x: number, y: number }): number => axis === 'y'
    ? sample.y
    : sample.x

  /** 只在听众拖滑块、点空白处时调用：这是它唯一写滚动位置的地方 */
  const moveTo = (position: number, behavior: ScrollBehavior) => {
    scroller()?.scrollTo(axis === 'y'
      ? { top: position, behavior }
      : { left: position, behavior })
  }

  // 拖滑块：指针怎么接（捕获、按住断了、作废、元素移除）由 attachGrip + 线性核心统一做；
  // 这里只把指针的移动换成滚动位置。点在滑块前后的空白处仍然翻一屏，不算拖动。
  const core = createSliderCore({
    begin(sample) {
      if (!scrollable || !strip)
        return null
      // 落在触屏那一块上：任何指针（手指、笔、鼠标）都按快速定位（和基线 target === grip 一致）
      const onGrip = sample.target === grip
      if (!onGrip) {
        // 触屏的手指只认那一块；落在细条上就交给浏览器滚动、点歌
        if (sample.pointerType === 'touch')
          return null
        const rect = strip.getBoundingClientRect()
        const at = along(sample) - (axis === 'y'
          ? rect.top
          : rect.left) - INSET
        if (at < offset || at > offset + thumb) {
          // 点在滑块前后的空白处：往那边翻一屏。这一条有多长就是一屏（页面那条正好是顶栏和底栏之间看得见的那一段）
          moveTo(metrics.position + (at < offset
            ? -length
            : length), scrollBehavior())
          return null
        }
      }
      dragStart = {
        from: along(sample),
        start: metrics.position,
      }
      starting = true
      quick = onGrip
      if (quick && sample.pointerType === 'touch') {
        // 抓住了：Android 上手指按住时轻震一下（iOS 的浏览器没有这个接口）
        navigator.vibrate?.(10)
      }
      return range > 0
        ? metrics.position / range
        : 0
    },
    track(sample) {
      const free = track - thumb
      // 滑块已经占满轨道：没有可拖的余地，停在现在的位置，别滚到顶
      if (free <= 0 || range <= 0)
        return metrics.position / Math.max(1, range)
      return (dragStart.start + (along(sample) - dragStart.from) * range / free) / range
    },
    commit: () => {},
    cancel: () => {},
    onValue(value) {
      dragging = value !== null
      if (value !== null) {
        // 按下的那一刻不写回位置（基线 grab 也不写）；动了以后才滚
        if (!starting) {
          const next = value * range
          if (Math.abs(next - metrics.position) > 0.5)
            moveTo(next, 'auto')
        }
        starting = false
        readMark()
      }
      else {
        starting = false
        quick = false
        linger()
      }
    },
  })
  // 这一条本身不写 touch-action：混合输入设备上，手指落在右侧 16px 仍要能滚页面；能按的 .grip 自己有 CSS
  const gripAttach = attachGrip(core, { touchAction: false })
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
    style:top={page?.top ?? (axis === 'x'
      ? `${metrics.cross - ZONE}px`
      : undefined)}
    style:bottom={page?.bottom}
    style:height={!page && axis === 'y'
      ? `${metrics.viewport}px`
      : undefined}
    style:width={axis === 'x'
      ? `${metrics.viewport}px`
      : undefined}
    aria-hidden={page ? 'true' : undefined}
    {@attach gripAttach}
    onpointerenter={event => (near = event.pointerType !== 'touch')}
    onpointerleave={() => {
      near = false
      linger()
    }}
    onmousedown={event => event.preventDefault()}
  >
    <div
      class={[
        'thumb',
        thick ? 'bg-primary-800' : 'bg-neutral-500/45',
      ]}
      style:height={axis === 'y'
        ? `${thumb}px`
        : undefined}
      style:width={axis === 'x'
        ? `${thumb}px`
        : undefined}
      style:transform={axis === 'y'
        ? `translateY(${offset}px)`
        : `translateX(${offset}px)`}
    ></div>
    {#if axis === 'y'}
      <div bind:this={grip} class={['grip', grabbable && 'grabbable']} style:top='{gripTop}px' style:height='{gripBottom - gripTop}px'></div>
    {/if}
    {#if lookup && axis === 'y'}
      <!-- 一直挂着（透明），第一次按住时也是从 0 淡入，而不是一下子冒出来 -->
      <div class={['bubble rounded-xl bg-white px-3.5 py-2 shadow-float', dragging && quick && mark && 'open']} style:top='{bubbleCenter}px' bind:offsetHeight={bubbleHeight}>
        {#if mark}
          <span class='block text-caption text-neutral-600 tabular-nums'>{mark.caption}</span>
          <span class='block truncate text-label text-neutral-900 font-500' lang={mark.lang}>{mark.title}</span>
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

{#if page}
  {@render bar()}
{:else}
  <div bind:this={host} class='sticky left-0 top-0 z-1 h-0' aria-hidden='true'>{@render bar()}</div>
{/if}

<style>
  /* 只有能悬停的精确指针（鼠标、触控板）才能拖、能点；触屏的点按和滑动都穿过去（除了下面的 .grip） */
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

  /* 淡出 200ms；加粗、变色 120ms。贴边、离两头的 2px 和脚本里的 INSET 一致 */
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

  /* 淡入 120ms */
  .shown .thumb {
    opacity: 1;
    transition-duration: var(--duration-feedback), var(--duration-feedback), var(--move-feedback);
    transition-timing-function: var(--ease-out-soft);
  }

  /* 触屏能按的那一块：贴着右边 44px 宽，只在以触屏为主的设备上、能按的时候接手指。
     按住时不让浏览器拿去平移页面、下拉刷新，也不弹长按的选字和菜单 */
  .grip {
    position: absolute;
    right: 0;
    width: 44px;
    pointer-events: none;
    touch-action: none;
    -webkit-touch-callout: none;
  }

  @media (pointer: coarse) {
    .grip.grabbable {
      pointer-events: auto;
    }
  }

  /* 气泡在滑块左边 56px，不被按着的手指挡住；淡入淡出 120ms */
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
