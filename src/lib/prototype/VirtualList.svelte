<!-- PROTOTYPE：等高行的虚拟列表，只渲染视口附近的几十行。跟随页面滚动，或跟随传入的滚动容器。 -->
<script lang='ts' generics='T'>
  import type { Snippet } from 'svelte'

  interface Props {
    items: T[]
    /** 每行高度（px），所有行等高 */
    itemHeight: number
    /** 滚动容器；不传则跟随整个页面滚动 */
    scrollParent?: HTMLElement | null
    /** 视口上下多渲染的行数 */
    overscan?: number
    getKey: (item: T, index: number) => string | number
    row: Snippet<[T, number]>
    class?: string
  }

  const { items, itemHeight, scrollParent = null, overscan = 8, getKey, row, class: klass = '' }: Props = $props()

  let host = $state<HTMLElement>()
  let range = $state({ start: 0, end: 30 })
  let lastStart = 0
  let lastEnd = 30

  function measure() {
    if (!host)
      return
    const rect = host.getBoundingClientRect()
    let viewTop: number
    let viewHeight: number
    if (scrollParent) {
      viewTop = scrollParent.getBoundingClientRect().top - rect.top
      viewHeight = scrollParent.clientHeight
    }
    else {
      viewTop = -rect.top
      viewHeight = window.innerHeight
    }
    const start = Math.max(0, Math.floor(viewTop / itemHeight) - overscan)
    const end = Math.min(items.length, Math.ceil((viewTop + viewHeight) / itemHeight) + overscan)
    if (start !== lastStart || end !== lastEnd) {
      lastStart = start
      lastEnd = end
      range = { start, end }
    }
  }

  $effect(() => {
    const target: HTMLElement | Window = scrollParent ?? window
    measure()
    target.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      target.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  })

  const visible = $derived.by(() => {
    const out: { item: T, index: number }[] = []
    const end = Math.min(range.end, items.length)
    for (let i = range.start; i < end; i++)
      out.push({ item: items[i], index: i })
    return out
  })
</script>

<div bind:this={host} class={klass} style:position='relative' style:height='{items.length * itemHeight}px'>
  {#each visible as { item, index } (getKey(item, index))}
    <div style:position='absolute' style:inset-inline='0' style:top='{index * itemHeight}px' style:height='{itemHeight}px'>
      {@render row(item, index)}
    </div>
  {/each}
</div>
