<script lang='ts'>
  import type { Snippet } from 'svelte'
  import ActiveItemBackground from '$lib/components/player/ActiveItemBackground.svelte'

  interface Props {
    items: any[]
    direction?: 'vertical' | 'horizontal'
    containerSize: number // px
    itemSize: number // px
    scrollPos?: number // 滚动位置由外部进行控制
    renderItem: Snippet<[any, number]>
    emptyItems?: number
    activeItemId?: number | null // 激活项的ID
    getItemId?: (item: any) => number | string // 获取项的ID的函数
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
    getItemId = item => item?.id,
  }: Props = $props()

  const isVertical = $derived(direction === 'vertical')

  let internalScrollPos = $state(0)

  const hasExternalScroll = $derived(scrollPos !== undefined)
  const effectiveScrollPos = $derived(hasExternalScroll ? scrollPos! : internalScrollPos)

  const curItems = $derived([...Array.from({ length: emptyItems }).fill(null), ...items])

  // 当前的可见项数量
  const visibleCount = $derived(Math.ceil(containerSize / itemSize) + 1)
  // 第一个可见项的起始索引
  const startIndex = $derived(Math.floor(effectiveScrollPos / itemSize))
  // 截取当前的可见项 items
  const visibleItems = $derived(curItems.slice(startIndex, startIndex + visibleCount))

  // 整个列表的总尺寸
  const totalSize = $derived(curItems.length * itemSize)

  const startOffset = $derived(startIndex * itemSize)

  // 计算激活项在全部列表中的索引
  const activeItemIndex = $derived.by(() => {
    if (activeItemId === null)
      return null
    return curItems.findIndex(item => item !== null && getItemId(item) === activeItemId)
  })

  // 判断激活项是否在可视范围内
  const isActiveItemVisible = $derived.by(() => {
    if (activeItemIndex === null)
      return false
    return activeItemIndex >= startIndex && activeItemIndex < startIndex + visibleCount
  })

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
  <div class={['scrollbar-none', containerClass]} style={containerStyle} onscroll={onScroll}>
    <div style={innerStyle}>
      <div style={translateStyle} class='relative'>
        {#if isActiveItemVisible}
          <ActiveItemBackground activeIndex={activeItemIndex} itemSize={itemSize} startIndex={startIndex} />
        {/if}
        {#each visibleItems as item, index}
          {#if item === null}
            <div style={`height: ${itemSize}px`}></div>
          {:else}
            <div class='relative z-10 flex items-center' style={`height: ${itemSize}px`}>
              {@render renderItem(item, index)}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
{:else}
  <div style={innerStyle}>
    <div style={translateStyle} class='relative'>
      {#if isActiveItemVisible}
        <ActiveItemBackground activeIndex={activeItemIndex} itemSize={itemSize} startIndex={startIndex} />
      {/if}
      {#each visibleItems as item, index}
        {#if item === null}
          <div style={`height: ${itemSize}px`}></div>
        {:else}
          <div class='relative z-10'>
            {@render renderItem(item, index)}
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}
