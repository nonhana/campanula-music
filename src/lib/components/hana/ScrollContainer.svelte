<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { onDestroy, onMount, tick } from 'svelte'

  interface Props {
    children?: Snippet
  }

  const { children }: Props = $props()

  let containerElement: HTMLDivElement | null = null
  let scrollContentElement: HTMLDivElement | null = null

  let containerHeight = $state(0)
  let contentHeight = $state(0)

  let scrollTop = $state(0)

  // 动态计算滚动条的高度，最短为 20px
  const thumbHeight = $derived.by(() => {
    if (containerHeight === 0 || contentHeight === 0)
      return 0
    const ratio = containerHeight / contentHeight
    return Math.max(ratio * containerHeight, 20)
  })

  const thumbTop = $derived.by(() => {
    if (contentHeight <= containerHeight)
      return 0
    const maxScrollTop = contentHeight - containerHeight
    const maxThumbTop = containerHeight - thumbHeight
    return (scrollTop / maxScrollTop) * maxThumbTop
  })

  const updateSizes = () => {
    tick().then(() => {
      if (containerElement && scrollContentElement) {
        containerHeight = containerElement.clientHeight
        contentHeight = scrollContentElement.scrollHeight
      }
    })
  }

  let startY = 0
  let startScrollTop = 0

  const onMouseMove = (e: MouseEvent) => {
    if (!scrollContentElement)
      return
    const deltaY = e.clientY - startY
    const scrollableHeight = contentHeight - containerHeight
    const trackHeight = containerHeight - thumbHeight
    const newScrollTop = startScrollTop + deltaY * (scrollableHeight / trackHeight)
    scrollContentElement.scrollTop = newScrollTop
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  const onScroll = () => {
    if (scrollContentElement) {
      scrollTop = scrollContentElement.scrollTop
    }
  }

  const onThumbMouseDown = (e: MouseEvent) => {
    startY = e.clientY
    startScrollTop = scrollTop
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
</script>

<div
  bind:this={containerElement}
  class='relative size-full overflow-hidden'
>
  <div bind:this={scrollContentElement} class='h-full overflow-auto scrollbar-hidden'>
    {@render children?.()}
  </div>

  <!-- Custom Scrollbar -->
  <div class='absolute top-0 w-2 h-full bg-primary-100 rounded right-1'>
    <div
      role='button'
      tabindex='0'
      class='bg-primary rounded'
      style='height: {thumbHeight}px; transform: translateY({thumbTop}px)'
      onmousedown={onThumbMouseDown}
    ></div>
  </div>
</div>
