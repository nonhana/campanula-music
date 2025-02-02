<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { onDestroy, onMount, tick } from 'svelte'

  interface Props {
    children?: Snippet
  }

  const { children }: Props = $props()

  let containerElement: HTMLDivElement | null = null
  let scrollContentElement: HTMLDivElement | null = null

  let scrollBarPos = $state<'right' | 'bottom' | 'none'>('right')
  const isRight = $derived(scrollBarPos === 'right')
  const isBottom = $derived(scrollBarPos === 'bottom')
  const isNone = $derived(scrollBarPos === 'none')

  let containerHeight = $state(0)
  let containerWidth = $state(0)
  let contentHeight = $state(0)
  let contentWidth = $state(0)

  let scrollOffset = $state(0)

  const updateSizes = () => {
    tick().then(() => {
      if (!(containerElement && scrollContentElement))
        return
      containerHeight = containerElement.clientHeight
      containerWidth = containerElement.clientWidth
      contentHeight = scrollContentElement.scrollHeight
      contentWidth = scrollContentElement.scrollWidth
      scrollBarPos = contentHeight > containerHeight
        ? 'right'
        : contentWidth > containerWidth
        ? 'bottom'
        : 'none'
    })
  }

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
    if (!scrollContentElement)
      return
    const deltaOffset = (isRight ? e.clientY : e.clientX) - startOffset
    const scrollableLength = isRight ? contentHeight - containerHeight : contentWidth - containerWidth
    const trackLength = (isRight ? containerHeight : containerWidth) - thumbLength
    const newScrollOffset = startScrollOffset + deltaOffset * (scrollableLength / trackLength)

    isRight ? scrollContentElement.scrollTop = newScrollOffset : scrollContentElement.scrollLeft = newScrollOffset
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  const onScroll = () => {
    if (scrollContentElement) {
      scrollOffset = isRight
        ? scrollContentElement.scrollTop
        : scrollContentElement.scrollLeft
    }
  }

  const onThumbMouseDown = (e: MouseEvent) => {
    startOffset = isRight ? e.clientY : e.clientX
    startScrollOffset = scrollOffset
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    e.preventDefault()
  }

  onMount(() => {
    updateSizes()
    scrollContentElement?.addEventListener('scroll', onScroll)
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateSizes)
    }
  })

  onDestroy(() => {
    scrollContentElement?.removeEventListener('scroll', onScroll)
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', updateSizes)
    }
  })

  const scrollBarStyle = $derived(
    isRight
      ? `width: 100%; height: ${thumbLength}px; transform: translateY(${thumbOffset}px)`
      : isBottom
      ? `height: 100%; width: ${thumbLength}px; transform: translateX(${thumbOffset}px)`
      : '',
  )
</script>

<div
  bind:this={containerElement}
  class={['relative size-full overflow-hidden group', isRight && 'pr-2.5', isBottom && 'pb-2.5']}
>
  <div bind:this={scrollContentElement} class='h-full overflow-auto scrollbar-hidden'>
    {@render children?.()}
  </div>

  <!-- Custom Scrollbar -->
  <div class={[
    'absolute bg-primary-100 rounded hidden group-hover:block',
    isRight && 'right-1 top-0 w-2 h-full',
    isBottom && 'bottom-1 left-0 h-2 w-full',
    isNone && 'hidden',
  ]}>
    <div
      role='button'
      tabindex='0'
      class='bg-primary rounded'
      style={scrollBarStyle}
      onmousedown={onThumbMouseDown}
    ></div>
  </div>
</div>
