<script lang='ts' generics='T'>
  import type { Snippet } from 'svelte'
  import { setContext } from 'svelte'
  import { writable } from 'svelte/store'
  import VirtualListCore from './VirtualListCore.svelte'

  interface Props {
    items: T[]
    direction?: 'vertical' | 'horizontal'
    containerSize: number // px
    itemSize: number // px
    scrollPos?: number // 滚动位置由外部进行控制
    renderItem: Snippet<[T, number]>
    headEmptyItems?: number
    tailEmptyItems?: number
    activeItemId?: number | string | null
    getItemById?: (id: number | string) => T | null
    throttleMs?: number // 滚动节流时间间隔
    onNearEnd?: () => void // 接近末尾时的回调函数
    endThreshold?: number // 触发预加载的阈值（0-1之间，表示剩余比例）
    bufferCount?: number // 可见项缓冲区数量
  }

  const {
    items,
    direction = 'vertical',
    containerSize,
    itemSize,
    scrollPos,
    renderItem,
    headEmptyItems = 0,
    tailEmptyItems = 0,
    activeItemId = null,
    getItemById,
    throttleMs = 16,
    onNearEnd,
    endThreshold = 0.2, // 默认当剩余20%时触发预加载
    bufferCount = 10,
  }: Props = $props()

  let scrollContainerElement = $state<HTMLDivElement | null>(null)

  const isVertical = $derived(direction === 'vertical')

  let internalScrollPos = $state(0)

  const hasExternalScroll = $derived(scrollPos !== undefined)
  const effectiveScrollPos = $derived(hasExternalScroll ? scrollPos! : internalScrollPos)

  const gap = $derived.by(() => {
    const containableCount = Math.floor(containerSize / itemSize)
    return (containerSize - containableCount * itemSize) / (containableCount - 1)
  })

  const emptyKey = Symbol('empty')

  const curItems = $derived([
    ...Array.from({ length: headEmptyItems }).map(() => ({ [emptyKey]: true })),
    ...items,
    ...Array.from({ length: tailEmptyItems }).map(() => ({ [emptyKey]: true })),
  ])

  const posData = writable<WeakMap<object, number> | null>(null)

  $effect(() => {
    const validItems = curItems.filter(item => typeof item === 'object' && item !== null)
    posData.set(
      new WeakMap(validItems.map((item, index) => [item, index * (itemSize + gap)])),
    )
  })

  setContext('VirtualList', { posData, emptyKey })

  $effect(() => {
    if (hasExternalScroll || !activeItemId || !$posData || !getItemById || !scrollContainerElement)
      return
    const activeItem = getItemById(activeItemId)
    if (!activeItem)
      return
    const targetPos = $posData.get(activeItem)
    if (targetPos === undefined)
      return
    scrollContainerElement.scrollTo({
      [isVertical ? 'top' : 'left']: targetPos,
      behavior: 'smooth',
    })
  })

  // 真实可见范围
  const baseVisibleCount = $derived(Math.ceil(containerSize / (itemSize + gap)))
  // 当 effectiveScrollPos 改变时，计算第一个可见项的起始索引
  const startIndex = $derived(Math.floor(effectiveScrollPos / (itemSize + gap)))
  // 前后各渲染 bufferCount 个
  const renderStartIndex = $derived(Math.max(0, startIndex - bufferCount))
  const renderEndIndex = $derived(
    Math.min(curItems.length, startIndex + baseVisibleCount + bufferCount),
  )
  // 截取当前需要渲染的 items
  const renderItems = $derived(curItems.slice(renderStartIndex, renderEndIndex))
  // 计算可见区域第一项在 renderItems 中的偏移量
  const visibleStartOffset = $derived(startIndex - renderStartIndex)

  // 整个列表的总尺寸
  const totalSize = $derived(curItems.length * itemSize + (curItems.length - 1) * gap)

  // 偏移改为基于 renderStartIndex
  const startOffset = $derived(renderStartIndex * (itemSize + gap))

  // 滚动节流相关变量
  let lastScrollTime = 0
  let scrollTimeoutId: number | null = null
  let pendingScrollUpdate = false
  let lastScrollEvent: Event | null = null

  // 预加载相关变量
  let hasTriggeredNearEnd = $state(false)

  // 检查是否接近末尾
  const checkNearEnd = () => {
    if (!onNearEnd || hasTriggeredNearEnd)
      return

    const scrollMax = totalSize - containerSize
    if (scrollMax <= 0)
      return // 内容不足以滚动

    const remainingScroll = scrollMax - effectiveScrollPos
    const remainingRatio = remainingScroll / scrollMax

    // 当剩余滚动比例小于阈值时，触发回调
    if (remainingRatio <= endThreshold) {
      hasTriggeredNearEnd = true
      onNearEnd()

      // 延迟重置触发状态，避免短时间内多次触发
      setTimeout(() => {
        hasTriggeredNearEnd = false
      }, 500) // 500ms 防抖时间
    }
  }

  // 实际更新滚动位置的函数
  const updateScrollPosition = (e: Event) => {
    if (hasExternalScroll)
      return
    const target = e.target as HTMLElement
    internalScrollPos = isVertical ? target.scrollTop : target.scrollLeft

    // 在更新滚动位置后检查是否需要预加载
    checkNearEnd()
  }

  // 节流后的滚动事件处理函数
  const throttledScroll = (e: Event) => {
    lastScrollEvent = e

    const now = Date.now()
    if (now - lastScrollTime >= throttleMs) {
      // 如果超过节流时间，立即执行
      lastScrollTime = now
      updateScrollPosition(e)
      pendingScrollUpdate = false
    }
    else if (!pendingScrollUpdate) {
      // 否则，安排一个延迟执行
      pendingScrollUpdate = true
      if (scrollTimeoutId)
        window.clearTimeout(scrollTimeoutId)
      scrollTimeoutId = window.setTimeout(() => {
        if (lastScrollEvent) {
          lastScrollTime = Date.now()
          updateScrollPosition(lastScrollEvent)
          pendingScrollUpdate = false
          lastScrollEvent = null
        }
      }, throttleMs)
    }
  }

  // 滚动事件
  const onScroll = (e: Event) => {
    if (hasExternalScroll)
      return
    throttledScroll(e)
  }

  const containerClass = $derived(`relative ${isVertical ? 'overflow-y-auto' : 'overflow-x-auto'}`)
  const containerStyle = $derived(isVertical ? `height: ${containerSize}px` : `width: ${containerSize}px; white-space: nowrap`)

  const innerStyle = $derived(
    isVertical
      ? `height: ${totalSize}px;`
      : `width: ${totalSize}px;`,
  )

  const translateStyle = $derived(
    isVertical
      ? `transform: translateY(${startOffset}px); display: flex; flex-direction: column; gap: ${gap}px`
      : `transform: translateX(${startOffset}px); display: flex; gap: ${gap}px`,
  )

  $effect(() => {
    if (items) {
      hasTriggeredNearEnd = false
    }
  })
</script>

{#if !hasExternalScroll}
  <div
    bind:this={scrollContainerElement}
    class={['scrollbar-none', containerClass]}
    style={containerStyle}
    onscroll={onScroll}
  >
    <VirtualListCore
      {innerStyle}
      {translateStyle}
      {renderItems}
      {itemSize}
      {renderItem}
      {visibleStartOffset}
      {activeItemId}
      {getItemById}
    />
  </div>
{:else}
  <VirtualListCore
    {innerStyle}
    {translateStyle}
    {renderItems}
    {itemSize}
    {renderItem}
    {visibleStartOffset}
    {activeItemId}
    {getItemById}
  />
{/if}
