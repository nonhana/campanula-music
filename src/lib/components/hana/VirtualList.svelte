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
    emptyItems?: number
    activeItemId?: number | string | null
    getItemById?: (id: number | string) => T | null
  }

  const {
    items,
    direction = 'vertical',
    containerSize,
    itemSize,
    scrollPos,
    renderItem,
    emptyItems = 0,
    activeItemId = null,
    getItemById,
  }: Props = $props()

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
    ...Array.from({ length: emptyItems }).map(() => ({ [emptyKey]: true })),
    ...items,
  ])

  const posData = writable<WeakMap<object, number> | null>(null)

  $effect(() => {
    const validItems = curItems.filter(item => typeof item === 'object' && item !== null)
    posData.set(
      new WeakMap(validItems.map((item, index) => [item, index * (itemSize + gap)])),
    )
  })

  setContext('VirtualList', { posData, emptyKey })

  // 当前的可见项数量
  const visibleCount = $derived(Math.ceil(containerSize / itemSize) + 1)
  // 第一个可见项的起始索引
  const startIndex = $derived(Math.floor(effectiveScrollPos / (itemSize + gap)))
  // 截取当前的可见项 items
  const visibleItems = $derived(curItems.slice(startIndex, startIndex + visibleCount))

  // 整个列表的总尺寸
  const totalSize = $derived(curItems.length * itemSize + (curItems.length - 1) * gap)

  const startOffset = $derived(startIndex * (itemSize + gap))

  // 滚动事件
  const onScroll = (e: Event) => {
    if (hasExternalScroll)
      return
    const target = e.target as HTMLElement
    internalScrollPos = isVertical ? target.scrollTop : target.scrollLeft
  }

  const containerClass = $derived(`relative ${isVertical ? 'overflow-auto' : 'overflow-x-auto'}`)
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
</script>

{#if !hasExternalScroll}
  <div class={['scrollbar-none', containerClass]} style={containerStyle} onscroll={onScroll}>
    <VirtualListCore
      {innerStyle}
      {translateStyle}
      {visibleItems}
      {itemSize}
      {renderItem}
      {activeItemId}
      {getItemById}
    />
  </div>
{:else}
  <VirtualListCore
    {innerStyle}
    {translateStyle}
    {visibleItems}
    {itemSize}
    {renderItem}
    {activeItemId}
    {getItemById}
  />
{/if}
