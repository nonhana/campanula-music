<!--
  等高行的虚拟列表：只渲染视口附近的几十行（几千首也一样）。默认跟随页面滚动；
  放在自己的滚动容器里（播放页的播放队列）时传 scrollParent，跟随它滚动。
  滚动、窗口大小变化、列表变化时重算要渲染哪几行。
  传了 markOf 时，告诉所在滚动区域的滚动条某个高度上是哪一行（ui/scroll-marks.ts），按住滚动条拖时气泡里写它。
  行是依次飘入的一组（motion.ts 的 reveal）：骨架换成列表时前几行依次飘入，之后滚出来的行不飘
-->
<script lang='ts' generics='T'>
  import type { Snippet } from 'svelte'
  import type { ScrollMark } from '../ui/scroll-marks'
  import { getScrollLookup, hasScrollLookup } from '../ui/scroll-marks'

  interface Props {
    items: readonly T[]
    /** 每行高度（px），所有行等高 */
    itemHeight: number
    /** 视口上下多渲染的行数 */
    overscan?: number
    /** 列表所在的滚动容器；不传就是页面 */
    scrollParent?: HTMLElement
    getKey: (item: T, index: number) => string | number
    row: Snippet<[T, number]>
    /** 这一行在滚动条的气泡里怎么写 */
    markOf?: (item: T, index: number) => ScrollMark
  }

  const { items, itemHeight, overscan = 8, scrollParent, getKey, row, markOf }: Props = $props()
  const lookup = hasScrollLookup() ? getScrollLookup() : null

  let host = $state<HTMLElement>()
  let range = $state({ start: 0, end: 0 })

  function measure() {
    if (!host)
      return
    const viewport = scrollParent ? { top: scrollParent.getBoundingClientRect().top, height: scrollParent.clientHeight } : { top: 0, height: window.innerHeight }
    const viewTop = viewport.top - host.getBoundingClientRect().top
    const start = Math.max(0, Math.floor(viewTop / itemHeight) - overscan)
    const end = Math.min(items.length, Math.ceil((viewTop + viewport.height) / itemHeight) + overscan)
    if (start !== range.start || end !== range.end)
      range = { start, end }
  }

  $effect(() => {
    // 列表变了（同步进来新的歌）也要重算
    void items.length
    measure()
  })

  $effect(() => {
    const scroller = scrollParent ?? window
    scroller.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      scroller.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  })

  $effect(() => {
    if (!lookup || !markOf)
      return
    const describe = markOf
    const markAt = (top: number) => {
      if (!host || items.length === 0)
        return null
      const index = Math.min(items.length - 1, Math.max(0, Math.floor((top - host.getBoundingClientRect().top) / itemHeight)))
      return describe(items[index], index)
    }
    lookup.markAt = markAt
    return () => {
      if (lookup.markAt === markAt)
        lookup.markAt = null
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

<div bind:this={host} class='relative' style:height='{items.length * itemHeight}px' data-reveal-group>
  {#each visible as { item, index } (getKey(item, index))}
    <div class='absolute inset-x-0' style:top='{index * itemHeight}px' style:height='{itemHeight}px'>
      {@render row(item, index)}
    </div>
  {/each}
</div>
