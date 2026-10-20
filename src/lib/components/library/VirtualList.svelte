<!--
  等高行的虚拟列表：只渲染视口附近的几十行（几千首也一样）。默认跟随页面滚动；
  放在自己的滚动容器里（播放页的播放队列）时传 scrollParent，跟随它滚动。
  滚动、窗口大小变化、列表变化时重算要渲染哪几行。
  传了 markOf 时，告诉所在滚动区域的滚动条某个高度上是哪一行（ui/scroll-marks.ts），按住滚动条拖时气泡里写它。
  行是依次飘入的一组（motion.ts 的 reveal）：骨架换成列表时前几行依次飘入，之后滚出来的行不飘
  拖动排序（#36）：placeOf 给出每一行放在哪个高度（拖动时让开空位），keep 让被拖的行一直挂载（Android 上手指底下的元素不能卸载）
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
    /** 拖动排序时这一行放在哪个高度（px）；不传就按 index * itemHeight */
    placeOf?: (item: T, index: number) => number
    /** 拖动排序时一直渲染的行（被拖的那几行不能被卸载） */
    keep?: (item: T, index: number) => boolean
    /** 拖动排序时每一行移动的过渡；不拖时不加，滚出来、换列表时直接到位 */
    animatePlace?: boolean
    /** 这一行藏起来（被拖的行留在原位、仍挂载，但看不见） */
    hidden?: (item: T, index: number) => boolean
  }

  const { items, itemHeight, overscan = 8, scrollParent, getKey, row, markOf, placeOf, keep, animatePlace = false, hidden }: Props = $props()
  const lookup = hasScrollLookup() ? getScrollLookup() : null

  let host = $state<HTMLElement>()
  let range = $state({ start: 0, end: 0 })

  const slots = $derived(items.length)

  function measure() {
    if (!host)
      return
    const viewport = scrollParent ? { top: scrollParent.getBoundingClientRect().top, height: scrollParent.clientHeight } : { top: 0, height: window.innerHeight }
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
      class={['absolute inset-x-0', animatePlace && 'transition-transform duration-move-state ease-out-soft']}
      style:transform='translateY({placeOf?.(item, index) ?? index * itemHeight}px)'
      style:height='{itemHeight}px'
      style:opacity={hidden?.(item, index) ? '0' : undefined}
    >
      {@render row(item, index)}
    </div>
  {/each}
</div>
