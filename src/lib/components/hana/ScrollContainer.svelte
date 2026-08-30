<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { browser } from '$app/environment'
  import { onDestroy, onMount, tick } from 'svelte'
  import { throttle } from 'throttle-debounce'

  interface Props {
    ariaLabel?: string
    contentWrapperClass?: string
    contentClass?: string
    scrollbarClass?: string
    scrollEvents?: ((e: Event) => void)[]
    scrollWatcher?: (scrollOffset: number) => void
    onHeightChange?: (height: number) => void
    children?: Snippet
  }

  const {
    ariaLabel,
    contentWrapperClass,
    contentClass,
    scrollbarClass,
    scrollEvents,
    scrollWatcher,
    onHeightChange,
    children,
  }: Props = $props()

  let containerElement: HTMLDivElement | null = null
  let contentWrapperElement: HTMLDivElement | null = null
  let contentElement: HTMLDivElement | null = null

  let scrollBarPos = $state<'right' | 'bottom' | 'none'>('right')
  const isRight = $derived(scrollBarPos === 'right')
  const isBottom = $derived(scrollBarPos === 'bottom')
  const isNone = $derived(scrollBarPos === 'none')

  let containerHeight = $state(0)
  let containerWidth = $state(0)
  let contentHeight = $state(0)
  let contentWidth = $state(0)

  let scrollOffset = $state(0)

  const onScrollDebounced = $derived(scrollWatcher ? throttle(100, scrollWatcher) : null)

  $effect(() => {
    if (onScrollDebounced) {
      onScrollDebounced(scrollOffset)
    }
  })

  // 动态计算滚动条的长度，最短为 20px
  const thumbLength = $derived.by(() => {
    if (
      ((containerHeight === 0 || contentHeight === 0) && isRight)
      || ((containerWidth === 0 || contentWidth === 0) && isBottom)
    ) {
      return 0
    }
    const ratio = isRight
      ? containerHeight / contentHeight
      : containerWidth / contentWidth
    return Math.max(ratio * (isRight ? containerHeight : containerWidth), 20)
  })

  const thumbOffset = $derived.by(() => {
    if (
      (contentHeight <= containerHeight && isRight)
      || (contentWidth <= containerWidth && isBottom)
    ) {
      return 0
    }
    const maxScrollLength = isRight
      ? contentHeight - containerHeight
      : contentWidth - containerWidth
    const maxThumbLength = isRight
      ? containerHeight - thumbLength
      : containerWidth - thumbLength
    return (scrollOffset / maxScrollLength) * maxThumbLength
  })

  let startOffset = 0
  let startScrollOffset = 0

  const onMouseMove = (e: MouseEvent) => {
    if (!contentWrapperElement)
      return
    const deltaOffset = (isRight ? e.clientY : e.clientX) - startOffset
    const scrollableLength = isRight ? contentHeight - containerHeight : contentWidth - containerWidth
    const trackLength = (isRight ? containerHeight : containerWidth) - thumbLength
    const newScrollOffset = startScrollOffset + deltaOffset * (scrollableLength / trackLength)
    if (isRight) {
      contentWrapperElement.scrollTop = newScrollOffset
    }
    else {
      contentWrapperElement.scrollLeft = newScrollOffset
    }
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  const onScroll = () => {
    if (contentWrapperElement) {
      scrollOffset = isRight
        ? contentWrapperElement.scrollTop
        : contentWrapperElement.scrollLeft
    }
  }

  const onThumbMouseDown = (e: MouseEvent) => {
    startOffset = isRight ? e.clientY : e.clientX
    startScrollOffset = scrollOffset
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    e.preventDefault()
  }

  let lastReportedHeight = -1

  const updateSizes = () => {
    tick().then(() => {
      if (!containerElement || !contentElement)
        return
      containerHeight = containerElement.clientHeight
      containerWidth = containerElement.clientWidth
      contentHeight = contentElement.scrollHeight
      contentWidth = contentElement.scrollWidth
      scrollBarPos = contentHeight > containerHeight
        ? 'right'
        : contentWidth > containerWidth
        ? 'bottom'
        : 'none'
      // 容器尺寸变化时同步给 VirtualList（containerSize 驱动可视窗口与 gap 计算）；值未变不重复上报
      if (containerHeight !== lastReportedHeight) {
        lastReportedHeight = containerHeight
        onHeightChange?.(containerHeight)
      }
    })
  }

  let resizeObserver: ResizeObserver | null = null

  onMount(() => {
    if (!containerElement || !contentWrapperElement || !contentElement)
      return
    contentWrapperElement.addEventListener('scroll', onScroll)
    scrollEvents?.forEach(fn => contentWrapperElement!.addEventListener('scroll', fn))
    resizeObserver = new ResizeObserver(updateSizes)
    // 同时观察容器与内容：容器尺寸变化驱动 onHeightChange（窗口缩放、布局调整），内容尺寸变化刷新滚动条
    resizeObserver.observe(containerElement)
    resizeObserver.observe(contentElement)
  })

  onDestroy(() => {
    // 节流器可能有待执行的 trailing 调用，卸载即取消
    onScrollDebounced?.cancel()
    // onDestroy 在 SSR 阶段也会执行（$effect 不跑但 onDestroy 跑）：document 仅存在于浏览器
    if (browser) {
      // 拖拽把手中途卸载时兜底移除 document 监听（正常路径由 onMouseUp 移除）
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    if (!contentWrapperElement)
      return
    contentWrapperElement.removeEventListener('scroll', onScroll)
    scrollEvents?.forEach(fn => contentWrapperElement!.removeEventListener('scroll', fn))
    resizeObserver?.disconnect()
  })

  const scrollBarStyle = $derived(
    isRight
      ? `width: 100%; height: ${thumbLength}px; transform: translateY(${thumbOffset}px)`
      : isBottom
      ? `height: 100%; width: ${thumbLength}px; transform: translateX(${thumbOffset}px)`
      : '',
  )

  let hovering = $state(false)

  onMount(() => {
    if (containerElement && containerElement.clientHeight !== lastReportedHeight) {
      lastReportedHeight = containerElement.clientHeight
      onHeightChange?.(lastReportedHeight)
    }
  })
</script>

<div
  role='group'
  bind:this={containerElement}
  class={['relative size-full overflow-hidden', isRight && 'md:pr-2.5', isBottom && 'md:pb-2.5']}
  onmouseenter={() => hovering = true}
  onmouseleave={() => hovering = false}
>
  <!-- 可滚动区域需可聚焦，键盘用户才能滚动内容；region 为非交互角色，豁免 tabindex 警告 -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    bind:this={contentWrapperElement}
    class={['w-full h-full overflow-auto scrollbar-none', contentWrapperClass]}
    tabindex='0'
    role='region'
    aria-label={ariaLabel}
  >
    <div bind:this={contentElement} class={contentClass}>
      {@render children?.()}
    </div>
  </div>

  <div class={[
    scrollbarClass,
    'absolute bg-primary-100 rounded opacity-0 transition-opacity hidden md:block',
    isRight && 'right-0 top-0 w-2 h-full',
    isBottom && 'bottom-0 left-0 h-2 w-full',
    isNone && 'hidden',
    hovering && 'opacity-100',
  ]}>
    <!-- 把手只承担鼠标拖拽（键盘滚动走容器本身），对读屏降级为装饰 -->
    <div
      aria-hidden='true'
      class='rounded bg-primary'
      style={scrollBarStyle}
      onmousedown={onThumbMouseDown}
    ></div>
  </div>
</div>
