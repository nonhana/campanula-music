<!--
  等高行的虚拟列表：只渲染视口附近的几十行，默认跟随页面滚动，放进自己的滚动容器时传 scrollParent。
  传了 markOf 时告诉滚动区域的气泡某个高度上是哪一行（shared/scroll-marks.ts）。行是依次飘入的一组（motion.ts 的 reveal）。
  拖动排序（#36）：placeOf 给出每一行的高度（拖动时让开空位），keep 让被拖的行一直挂载（Android 上手指底下的元素不能卸载）。
-->
<script lang='ts' generics='T'>
  import type { Snippet } from 'svelte'

  import type { ScrollMark } from '../shared/scroll-marks'
  import { getScrollLookup, hasScrollLookup } from '../shared/scroll-marks'

  interface Props {
    items: readonly T[]
    /** px，所有行等高 */
    itemHeight: number
    overscan?: number
    scrollParent?: HTMLElement
    getKey: (item: T, index: number) => string | number
    row: Snippet<[T, number]>
    /** 气泡里怎么写这一行 */
    markOf?: (item: T, index: number) => ScrollMark
    /** 拖动排序时这一行放在哪个高度（px）；不传就按 index * itemHeight */
    placeOf?: (item: T, index: number) => number
    keep?: (item: T, index: number) => boolean
    /** 拖动排序时每一行移动的过渡；不拖时不加，滚出来、换列表时直接到位 */
    animatePlace?: boolean
    hidden?: (item: T, index: number) => boolean
  }

  const { items, itemHeight, overscan = 8, scrollParent, getKey, row, markOf, placeOf, keep, animatePlace = false, hidden }: Props = $props()
  const lookup = hasScrollLookup()
    ? getScrollLookup()
    : null

  let host = $state<HTMLElement>()
  let range = $state({ start: 0, end: 0 })

  const slots = $derived(items.length)

  const measure = () => {
    if (!host)
      return
    const viewport = scrollParent
      ? { top: scrollParent.getBoundingClientRect().top, height: scrollParent.clientHeight }
      : { top: 0, height: window.innerHeight }
    const viewTop = viewport.top - host.getBoundingClientRect().top
    const start = Math.max(0, Math.floor(viewTop / itemHeight) - overscan)
    const end = Math.min(slots, Math.ceil((viewTop + viewport.height) / itemHeight) + overscan)
    if (start !== range.start || end !== range.end)
      range = { start, end }
  }

  $effect(() => {
    // 列表变了（同步进来新的歌）也要重算
    void items.length
    void slots
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
    for (let i = 0; i < items.length; i += 1) {
      // 拖动时 items 是原顺序，行要靠 placeOf 的视觉位置决定挂不挂载；只按 index 会在多选拖很多首时把下方正需要的行卸掉
      const slot = Math.floor((placeOf?.(items[i]!, i) ?? i * itemHeight) / itemHeight)
      if ((slot >= range.start && slot < Math.min(range.end, items.length)) || keep?.(items[i]!, i))
        out.push({ item: items[i]!, index: i })
    }
    return out
  })
</script>

<div bind:this={host} class='relative' style:height='{slots * itemHeight}px' data-reveal-group>
  {#each visible as { item, index } (getKey(item, index))}
    <div
      class={['absolute inset-x-0', animatePlace && 'drag-move']}
      style:transform='translateY({placeOf?.(item, index) ?? index * itemHeight}px)'
      style:height='{itemHeight}px'
      style:opacity={hidden?.(item, index)
        ? '0'
        : undefined}
    >
      {@render row(item, index)}
    </div>
  {/each}
</div>

<style>
  /* 拖动排序：行的位移和藏起来时的透明度都走动效令牌；减少动态效果时位移直接到位、只剩淡入淡出 */
  .drag-move {
    transition:
      transform var(--move-state) var(--ease-out-soft),
      opacity var(--duration-state) var(--ease-out-soft);
  }
</style>
