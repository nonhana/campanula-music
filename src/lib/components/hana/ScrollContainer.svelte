<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { onDestroy, onMount, tick } from 'svelte'
  import { throttle } from 'throttle-debounce'

  interface Props {
    contentWrapperClass?: string
    contentClass?: string
    scrollbarClass?: string
    scrollEvents?: ((e: Event) => void)[]
    scrollWatcher?: (scrollOffset: number) => void
    onHeightChange?: (height: number) => void
    children?: Snippet
  }

  const {
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

  const updateSizes = () => {
    if (contentWrapperElement) {
      contentWrapperElement.scrollTop = 0
      contentWrapperElement.scrollLeft = 0
      scrollOffset = 0
    }

    tick().then(() => {
      if (!containerElement || !contentElement)
        return
      const contentRect = contentElement.getBoundingClientRect()
      containerHeight = containerElement.clientHeight
      containerWidth = containerElement.clientWidth
      contentHeight = contentRect.height
      contentWidth = contentRect.width
      scrollBarPos = contentHeight > containerHeight
        ? 'right'
        : contentWidth > containerWidth
        ? 'bottom'
        : 'none'
    })
  }

  let resizeObserver: ResizeObserver | null = null

  onMount(() => {
    if (!contentWrapperElement || !contentElement)
      return
    contentWrapperElement.addEventListener('scroll', onScroll)
    scrollEvents?.forEach(fn => contentWrapperElement!.addEventListener('scroll', fn))
    resizeObserver = new ResizeObserver(updateSizes)
    resizeObserver.observe(contentElement)
  })

  onDestroy(() => {
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
    if (containerElement) {
      const { height } = containerElement.getBoundingClientRect()
      onHeightChange?.(height)
    }
  })
</script>

<div
  role='group'
  bind:this={containerElement}
  class={['relative size-full overflow-hidden', isRight && 'pr-2.5', isBottom && 'pb-2.5']}
  onmouseenter={() => hovering = true}
  onmouseleave={() => hovering = false}
>
  <div bind:this={contentWrapperElement} class={['w-full h-full overflow-auto scrollbar-none', contentWrapperClass]}>
    <div bind:this={contentElement} class={contentClass}>
      {@render children?.()}
    </div>
  </div>

  <div class={[
    scrollbarClass,
    'absolute bg-primary-100 rounded opacity-0 transition-opacity',
    isRight && 'right-0 top-0 w-2 h-full',
    isBottom && 'bottom-0 left-0 h-2 w-full',
    isNone && 'hidden',
    hovering && 'opacity-100',
  ]}>
    <div
      role='button'
      tabindex='0'
      class='rounded bg-primary'
      style={scrollBarStyle}
      onmousedown={onThumbMouseDown}
    ></div>
  </div>
</div>
