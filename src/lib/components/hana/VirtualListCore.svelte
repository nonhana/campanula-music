<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { Writable } from 'svelte/store'
  import { getContext } from 'svelte'

  interface Props {
    innerStyle: string
    translateStyle: string
    visibleItems: any[]
    itemSize: number
    renderItem: Snippet<[any, number]>
    activeItemId?: number | string | null
    getItemById?: (id: number | string) => any | null
  }

  const { innerStyle, translateStyle, visibleItems, itemSize, renderItem, activeItemId, getItemById }: Props = $props()

  const { posData, emptyKey } = getContext<{
    posData: Writable<WeakMap<any, number>>
    emptyKey: symbol
  }>('VirtualList')

  const activeItemOffset = $derived.by(() => {
    if (!activeItemId || !$posData || !getItemById)
      return 0
    const activeItem = getItemById(activeItemId)
    if (!activeItem)
      return 0
    const result = $posData.get(activeItem)
    return result ?? 0
  })

  const bgStyle = $derived(`height: ${itemSize}px; transform: translateY(${activeItemOffset}px);`)
</script>

<div class='relative' style={innerStyle}>
  {#if activeItemId !== undefined && activeItemId !== null && getItemById}
    <div class='absolute w-full rounded-lg bg-primary/60 transition-transform' style={bgStyle}></div>
  {/if}
  <div style={translateStyle} class='relative'>
    {#each visibleItems as item, index}
      {#if (item as any)[emptyKey]}
        <div style={`height: ${itemSize}px`}></div>
      {:else}
        {@render renderItem(item, index)}
      {/if}
    {/each}
  </div>
</div>
