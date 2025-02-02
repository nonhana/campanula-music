<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    items: any[]
    direction?: 'vertical' | 'horizontal'
    containerSize: number // px
    itemSize: number // px
    scrollPos?: number // 滚动位置由外部进行控制
    renderItem: Snippet<[any]>
  }

  const {
    items,
    direction = 'vertical',
    containerSize,
    itemSize,
    scrollPos,
    renderItem,
  }: Props = $props()

  const isVertical = $derived(direction === 'vertical')

  let internalScrollPos = $state(0)

  const hasExternalScroll = $derived(scrollPos !== undefined)
  const effectiveScrollPos = $derived(hasExternalScroll ? scrollPos! : internalScrollPos)

  // 当前的可见项数量
  const visibleCount = $derived(Math.ceil(containerSize / itemSize) + 1)
  // 第一个可见项的起始索引
  const startIndex = $derived(Math.floor(effectiveScrollPos / itemSize))
  // 截取当前的可见项 items
  const visibleItems = $derived(items.slice(startIndex, startIndex + visibleCount))

  // 整个列表的总尺寸
  const totalSize = $derived(items.length * itemSize)

  const startOffset = $derived(startIndex * itemSize)

  // 滚动事件
  const onScroll = (e: Event) => {
    if (hasExternalScroll)
      return
    const target = e.target as HTMLElement
    internalScrollPos = isVertical ? target.scrollTop : target.scrollLeft
  }

  const containerClass = $derived(isVertical ? 'overflow-auto' : 'overflow-x-auto')
  const containerStyle = $derived(isVertical ? `height: ${containerSize}px` : `width: ${containerSize}px; white-space: nowrap`)

  const innerStyle = $derived(
    isVertical
      ? `height: ${totalSize}px; position: relative`
      : `width: ${totalSize}px; position: relative`,
  )

  const translateStyle = $derived(
    isVertical
      ? `transform: translateY(${startOffset}px)`
      : `transform: translateX(${startOffset}px)`,
  )
</script>

{#if !hasExternalScroll}
  <div class={containerClass} style={containerStyle} onscroll={onScroll}>
    <div style={innerStyle}>
      <div class={translateStyle}>
        {#each visibleItems as item}
          {@render renderItem(item)}
        {/each}
      </div>
    </div>
  </div>
{:else}
  <div style={innerStyle}>
    <div style={translateStyle}>
      {#each visibleItems as item}
        {@render renderItem(item)}
      {/each}
    </div>
  </div>
{/if}
