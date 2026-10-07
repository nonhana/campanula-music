<!--
  PROTOTYPE：引擎“dnd-kit”（@dnd-kit/svelte 0.5.0，2026-06）。每行在 KitRow 里各自 createSortable；
  虚拟列表按绝对定位排行，只渲染视口附近几十行，被拖的那一行无论滚到哪儿都保持挂载（库要靠它的元素跟手）。
  拖过别的行时在 onDragOver 里改顺序（Svelte 版默认不带 OptimisticSortingPlugin），松手才提交。
  - 触屏：方案 A 长按到时开始拖（不动松手当作长按进入多选）；B/C 只从把手拖，把手上不等待。传感器传给每一行（见 kitSensors.ts）。
  - 自动滚动是库自带的 AutoScroller：速度按原型面板的“最高速度”换算成 acceleration，边缘区是视口高度的 15%，没有停留加速。
  - 只能一次拖一首（库没有多选拖动）。
-->
<script lang='ts'>
  import type { DragEndEvent, DragMoveEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/dom'
  import type { Song } from '../data'
  import type { Variant } from '../store.svelte'
  import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers'
  import { AutoScroller } from '@dnd-kit/dom'
  import { DragDropProvider } from '@dnd-kit/svelte'
  import { isSortable } from '@dnd-kit/svelte/sortable'
  import { longPress, longPressSelect, suppressClick, vibrate, visibleRange } from '../interact'
  import { settings } from '../settings.svelte'
  import { applyOrder, beginDragStats, dragStats, endDragStats, selection } from '../store.svelte'
  import KitRow from './KitRow.svelte'

  interface Props {
    list: Song[]
    plId: string
    sortable: boolean
    phone: boolean
    variant: Variant
  }

  const { list, plId, sortable, phone, variant }: Props = $props()

  const ROW = 56

  let host = $state<HTMLElement>()
  let range = $state({ start: 0, end: 30 })
  let items = $state.raw<Song[]>([])
  let dragId = $state<string | null>(null)
  let startIndex = 0
  let down = { x: 0, y: 0, touch: false }
  let up = { x: 0, y: 0 }
  /** 这次拖动里手指离起点最远多少像素（判断“长按后没挪动就松手”） */
  let travel = 0

  const shown = $derived(dragId ? items : list)
  const showGrip = $derived(sortable && (variant === 'B' || (variant === 'C' && selection.mode)))
  const gripAt = $derived(!showGrip ? 'none' : variant === 'B' ? 'lead' : 'end') as 'none' | 'lead' | 'end'
  const canDrag = $derived(sortable && (variant !== 'C' || selection.mode))

  function measure() {
    if (!host)
      return
    const r = visibleRange(host, ROW, shown.length)
    if (r.start !== range.start || r.end !== range.end)
      range = r
  }

  $effect(() => {
    void shown.length
    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  })

  const rendered = $derived.by(() => {
    const out: { song: Song, index: number }[] = []
    const end = Math.min(range.end, shown.length)
    for (let i = range.start; i < end; i++)
      out.push({ song: shown[i], index: i })
    if (dragId) {
      const i = shown.findIndex(s => s.id === dragId)
      if (i >= 0 && (i < range.start || i >= end))
        out.push({ song: shown[i], index: i })
    }
    return out
  })

  const plugins = $derived((defaults: any[]) => [
    ...defaults.filter(p => p !== AutoScroller),
    AutoScroller.configure({ acceleration: settings.maxSpeed / 60, threshold: { x: 0, y: 0.15 } }),
  ])

  function onDragStart(event: DragStartEvent) {
    const id = String(event.operation.source?.id)
    items = list
    dragId = id
    travel = 0
    startIndex = list.findIndex(s => s.id === id)
    if (down.touch)
      vibrate(10)
    beginDragStats('dnd-kit', startIndex + 1, 1)
  }

  function onDragMove(event: DragMoveEvent) {
    const d = event.operation.position.delta
    if (d)
      travel = Math.max(travel, Math.hypot(d.x, d.y))
  }

  function onDragOver(event: DragOverEvent) {
    const { source, target } = event.operation
    if (!isSortable(source) || !isSortable(target))
      return
    const from = items.findIndex(s => s.id === String(source.id))
    const to = items.findIndex(s => s.id === String(target.id))
    if (from < 0 || to < 0 || from === to)
      return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    items = next
    dragStats.to = to + 1
  }

  function onDragEnd(event: DragEndEvent) {
    const id = dragId
    const to = items.findIndex(s => s.id === id)
    const moved = !event.canceled && to !== startIndex
    endDragStats(moved)
    if (moved)
      applyOrder(plId, items)
    // 方案 A：长按到时库就“开始拖”了；不挪动直接松手，当作长按进入多选。
    // 库抓住指针后 pointerup 不再冒泡到窗口、松手时位置也已经清掉了，所以看拖动过程中记下的最远距离
    if (!moved && variant === 'A' && down.touch && travel < 8 && id) {
      // 松手后浏览器还会补一次 click，别让它把刚勾上的这首又取消掉
      suppressClick()
      longPressSelect(id)
    }
    dragId = null
    items = []
  }

  function track(node: HTMLElement) {
    const d = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' }
      up = { x: e.clientX, y: e.clientY }
    }
    const u = (e: PointerEvent) => {
      up = { x: e.clientX, y: e.clientY }
    }
    node.addEventListener('pointerdown', d, true)
    window.addEventListener('pointerup', u, true)
    return () => {
      node.removeEventListener('pointerdown', d, true)
      window.removeEventListener('pointerup', u, true)
    }
  }

  const pressOptions = {
    ms: () => settings.longPress,
    accept: () => !(variant === 'A' && sortable),
    onPress: (key: string) => longPressSelect(key),
  }
</script>

<DragDropProvider {plugins} modifiers={[RestrictToVerticalAxis]} {onDragStart} {onDragMove} {onDragOver} {onDragEnd}>
  <div
    bind:this={host}
    class='klist relative'
    style:height='{shown.length * ROW}px'
    role='list'
    aria-label='歌单里的歌曲'
    {@attach track}
    {@attach longPress(pressOptions)}
  >
    {#each rendered as it (it.song.id)}
      <div class='slot' style:transform='translateY({it.index * ROW}px)' role='listitem'>
        <KitRow song={it.song} index={it.index} {list} {phone} disabled={!canDrag} {showGrip} {gripAt} />
      </div>
    {/each}
  </div>
</DragDropProvider>

<style>
  .slot {
    position: absolute;
    inset: 0 0 auto 0;
    height: 56px;
  }
</style>
