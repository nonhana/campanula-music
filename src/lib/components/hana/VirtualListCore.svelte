<script lang='ts' generics='T'>
  import type { Snippet } from 'svelte'
  import type { Writable } from 'svelte/store'
  import { getContext } from 'svelte'

  type ItemWithEmpty<T> = T | { [key: symbol]: true }

  interface Props {
    innerStyle: string
    translateStyle: string
    renderItems: ItemWithEmpty<T>[]
    itemSize: number
    renderItem: Snippet<[T, number]>
    visibleStartOffset: number
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
    activeItemId,
    getItemById,
  }: Props = $props()

  const { posData, emptyKey } = getContext<{
    posData: Writable<WeakMap<object, number> | null>
    emptyKey: symbol
  }>('VirtualList')

  function isEmptyItem(item: ItemWithEmpty<T>): item is { [key: symbol]: true } {
    return typeof item === 'object' && item !== null && emptyKey in item
  }

  const activeItemOffset = $derived.by(() => {
    if (!activeItemId || !$posData || !getItemById)
      return 0
    const activeItem = getItemById(activeItemId)
    if (!activeItem)
      return 0
    const result = $posData.get(activeItem as object)
    return result ?? 0
  })

  const bgStyle = $derived(`height: ${itemSize}px; transform: translateY(${activeItemOffset}px);`)
</script>

<div class='relative' style={innerStyle}>
  {#if activeItemId !== undefined && activeItemId !== null && getItemById}
    <div class='absolute w-full rounded-lg bg-primary/60 transition-transform' style={bgStyle}></div>
  {/if}
  <div style={translateStyle} class='relative'>
    {#each renderItems as item, index (isEmptyItem(item) ? `empty-${index}` : item)}
      {#if isEmptyItem(item)}
        <div style={`height: ${itemSize}px`}></div>
      {:else}
        {@render renderItem(item, index - visibleStartOffset)}
      {/if}
    {/each}
  </div>
</div>
