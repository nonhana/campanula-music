<script lang='ts' generics='T'>
  import type { Snippet } from 'svelte'
  import { getContext } from 'svelte'

  type ItemWithEmpty<T> = T | { [key: symbol]: true }

  interface Props {
    innerStyle: string
    translateStyle: string
    renderItems: ItemWithEmpty<T>[]
    itemSize: number
    renderItem: Snippet<[T, number]>
    visibleStartOffset: number
    renderStartIndex: number
    activeItemId?: number | string | null
    getItemById?: (id: number | string) => T | null
  }

  const {
    innerStyle,
    translateStyle,
    renderItems,
    itemSize,
    renderItem,
    visibleStartOffset,
    renderStartIndex,
    activeItemId,
    getItemById,
  }: Props = $props()

  const { emptyKey, getItemPos } = getContext<{
    emptyKey: symbol
    getItemPos: (item: object) => number | undefined
  }>('VirtualList')

  const isEmptyItem = (item: ItemWithEmpty<T>): item is { [key: symbol]: true } => {
    return typeof item === 'object' && item !== null && emptyKey in item
  }

  const activeItemOffset = $derived.by(() => {
    if (!activeItemId || !getItemById)
      return 0
    const activeItem = getItemById(activeItemId)
    if (!activeItem)
      return 0
    return getItemPos(activeItem) ?? 0
  })

  const bgStyle = $derived(`height: ${itemSize}px; transform: translateY(${activeItemOffset}px);`)
</script>

<div class='relative' style={innerStyle}>
  {#if activeItemId !== undefined && activeItemId !== null && getItemById}
    <div class='absolute w-full rounded-lg bg-primary/60 transition-transform' style={bgStyle}></div>
  {/if}
  <div style={translateStyle} class='relative'>
    {#each renderItems as item, index (renderStartIndex + index)}
      {#if isEmptyItem(item)}
        <div style={`height: ${itemSize}px`}></div>
      {:else}
        {@render renderItem(item, index - visibleStartOffset)}
      {/if}
    {/each}
  </div>
</div>
