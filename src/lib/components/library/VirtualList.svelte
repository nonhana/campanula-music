<!--
  等高行的虚拟列表：跟随页面滚动，只渲染视口附近的几十行（几千首也一样）。
  滚动、窗口大小变化、列表变化时重算要渲染哪几行。
-->
<script lang='ts' generics='T'>
  import type { Snippet } from 'svelte'

  interface Props {
    items: readonly T[]
    /** 每行高度（px），所有行等高 */
    itemHeight: number
    /** 视口上下多渲染的行数 */
    overscan?: number
    getKey: (item: T, index: number) => string | number
    row: Snippet<[T, number]>
  }

  const { items, itemHeight, overscan = 8, getKey, row }: Props = $props()

  let host = $state<HTMLElement>()
  let range = $state({ start: 0, end: 0 })

  function measure() {
    if (!host)
      return
    const viewTop = -host.getBoundingClientRect().top
    const start = Math.max(0, Math.floor(viewTop / itemHeight) - overscan)
    const end = Math.min(items.length, Math.ceil((viewTop + window.innerHeight) / itemHeight) + overscan)
    if (start !== range.start || end !== range.end)
      range = { start, end }
  }

  $effect(() => {
    // 列表变了（同步进来新的歌）也要重算
    void items.length
    measure()
  })

  $effect(() => {
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure)
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

<div bind:this={host} class='relative' style:height='{items.length * itemHeight}px'>
  {#each visible as { item, index } (getKey(item, index))}
    <div class='absolute inset-x-0' style:top='{index * itemHeight}px' style:height='{itemHeight}px'>
      {@render row(item, index)}
    </div>
  {/each}
</div>
