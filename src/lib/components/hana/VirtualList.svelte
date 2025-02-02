<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    items: any[]
    direction?: 'vertical' | 'horizontal'
    containerSize: number // rem
    itemSize: number // rem
    getKey?: (item: any, index: number) => string | number
    scrollPos?: number // 滚动位置由外部进行控制
    children: Snippet<[any]>
  }

  const {
    items,
    direction = 'vertical',
    containerSize,
    itemSize,
    scrollPos,
    children,
  }: Props = $props()

  const isVertical = $derived(direction === 'vertical')

  let internalScrollPos = $state(0)

  const hasExternalScroll = $derived(scrollPos !== undefined)
  const effectiveScrollPos = $derived(hasExternalScroll ? scrollPos! : internalScrollPos)

  // 当前的可见项数量
  const visibleCount = $derived(Math.ceil(containerSize / itemSize) + 5)
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
  const containerStyle = $derived(isVertical ? `height: ${containerSize}rem` : `width: ${containerSize}rem; white-space: nowrap`)

  const innerStyle = $derived(
    isVertical
      ? `height: ${totalSize}rem; position: relative`
      : `width: ${totalSize}rem; position: relative`,
  )

  const translateStyle = $derived(
    isVertical
      ? `transform: translateY(${startOffset}rem)`
      : `transform: translateX(${startOffset}rem)`,
  )
</script>

{#if hasExternalScroll}
  <div class={containerClass} style={containerStyle} onscroll={onScroll}>
    <div style={innerStyle}>
      <div class={translateStyle}>
        {#each visibleItems as item}
          {@render children(item)}
        {/each}
      </div>
    </div>
  </div>
{:else}
  <div style={innerStyle}>
    <div style={translateStyle}>
      {#each visibleItems as item}
        {@render children(item)}
      {/each}
    </div>
  </div>
{/if}
