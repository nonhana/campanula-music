<!--
  PROTOTYPE：引擎“svelte-dnd-action”（0.9.80）。库要求拖放区的子元素和传进去的 items 一一对应，
  所以虚拟列表改成“流式窗口”：拖放区只放视口附近的几十行，上下用 padding 撑出整张歌单的高度。
  滚动时窗口跟着换，库每次把它看到的那一段（含占位的“影子”）交回来，这里按编号把这一段拼回整张歌单。
  影子行必须一直是同一个 DOM 节点（库只给它加 visibility: hidden）：手指底下的元素一旦被卸载，Android 上的触摸事件就断了，
  所以拖动时窗口会扩大到一定包含影子那一行。
  - 方案 A：delayTouchStart = 长按时长；不动松手当作长按进入多选。B/C：dragHandleZone + 把手。
  - 自动滚动是库自带的：只认滚动区域边缘 30px，越靠边越快，每帧最多 30px，不能调。
  - 只能一次拖一首（库的多选拖动只有示例，没有正式支持）。
-->
<script lang='ts'>
  import type { DndEvent } from 'svelte-dnd-action'
  import type { Song } from '../data'
  import type { Variant } from '../store.svelte'
  import { flip } from 'svelte/animate'
  import { fromAction } from 'svelte/attachments'
  import { dndzone, dragHandle, dragHandleZone, SHADOW_ITEM_MARKER_PROPERTY_NAME, TRIGGERS } from 'svelte-dnd-action'
  import { activateRow, longPress, longPressSelect, openMenu, suppressClick, vibrate, visibleRange } from '../interact'
  import DesktopRow from '../rows/DesktopRow.svelte'
  import PhoneRow from '../rows/PhoneRow.svelte'
  import { settings } from '../settings.svelte'
  import { applyOrder, beginDragStats, dragStats, endDragStats, player, selection } from '../store.svelte'

  interface Props {
    list: Song[]
    plId: string
    sortable: boolean
    phone: boolean
    variant: Variant
  }

  const { list, plId, sortable, phone, variant }: Props = $props()

  interface Item {
    id: string
    song: Song
    /** 库给影子（被拖那一行的占位）打的标记，必须原样传回给库，否则库认不出影子，会再插一份 */
    [SHADOW_ITEM_MARKER_PROPERTY_NAME]?: boolean
  }

  const ROW = 56
  const gripAttachment = fromAction(dragHandle)

  let host = $state<HTMLElement>()
  let range = $state({ start: 0, end: 30 })
  let dragAll = $state.raw<Item[]>([])
  let dragId = $state<string | null>(null)
  let startIndex = 0
  let down = { x: 0, y: 0, touch: false }
  /** 方案 A：这次拖动是触屏长按浮起的，松手时如果没挪过，就当作长按进入多选（每次拖动只认一次松手） */
  let liftByPress: string | null = null

  const listItems = $derived(list.map(s => ({ id: s.id, song: s })))
  const shown = $derived(dragId ? dragAll : listItems)
  const handles = $derived(variant !== 'A')
  const showGrip = $derived(sortable && (variant === 'B' || (variant === 'C' && selection.mode)))
  const gripAt = $derived(!showGrip ? 'none' : variant === 'B' ? 'lead' : 'end') as 'none' | 'lead' | 'end'

  /** 影子现在在整张歌单里的位置（库刚开始拖时影子的编号是占位编号，之后换成被拖那首的编号） */
  function shadowIndex(all: Item[]): number {
    const marked = all.findIndex(i => i[SHADOW_ITEM_MARKER_PROPERTY_NAME])
    return marked >= 0 ? marked : all.findIndex(i => i.id === dragId)
  }

  /** 实际放进拖放区的那一段：视口附近；拖动时一定包含影子那一行 */
  const win = $derived.by(() => {
    if (!dragId)
      return range
    const s = shadowIndex(shown)
    if (s < 0)
      return range
    return { start: Math.min(range.start, s), end: Math.max(range.end, s + 1) }
  })
  const windowItems = $derived(shown.slice(win.start, win.end))

  function measure() {
    if (!host)
      return
    // 拖放区自己带着上面的 padding，它的顶边就是第 1 首的顶边
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

  /**
   * 把库交回来的这一段（可能带着影子）按位置拼回整张歌单。
   * 交回来的这一段对应整张歌单里“除了影子之外”的第 start 到 start+n 首；影子在这一段里的位置就是它在整张歌单里的位置。
   */
  function isReal(i: Item) {
    return !i[SHADOW_ITEM_MARKER_PROPERTY_NAME] && i.id !== dragId
  }

  function merge(all: Item[], items: Item[]): Item[] {
    const rest = all.filter(isReal)
    const first = items.find(isReal)
    if (!first)
      return all
    const at = rest.findIndex(i => i.id === first.id) - items.slice(0, items.indexOf(first)).filter(isReal).length
    if (at < 0)
      return all
    const n = items.filter(isReal).length
    return [...rest.slice(0, at), ...items, ...rest.slice(at + n)]
  }

  function onconsider(e: CustomEvent<DndEvent<Item>>) {
    const { items, info } = e.detail
    if (info.trigger === TRIGGERS.DRAG_STARTED) {
      dragId = String(info.id)
      dragAll = listItems
      startIndex = list.findIndex(s => s.id === dragId)
      if (down.touch)
        vibrate(10)
      liftByPress = down.touch && variant === 'A' ? dragId : null
      beginDragStats('svelte-dnd-action', startIndex + 1, 1)
    }
    dragAll = merge(dragAll, items)
    dragStats.to = shadowIndex(dragAll) + 1
  }

  function onfinalize(e: CustomEvent<DndEvent<Item>>) {
    const { items, info } = e.detail
    const merged = merge(dragAll.length ? dragAll : listItems, items).map(i => ({ id: i.id, song: i.song }))
    const to = merged.findIndex(i => i.id === String(info.id))
    const moved = to !== startIndex && to >= 0
    dragStats.to = to + 1
    endDragStats(moved)
    if (moved)
      applyOrder(plId, merged.map(i => i.song))
    dragId = null
    dragAll = []
  }

  function track(node: HTMLElement) {
    const d = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' }
    }
    // 方案 A：长按到时库就"开始拖"了；不挪动直接松手，当作长按进入多选。
    // 必须在松手这一刻决定，不能等 finalize：库松手后还要播 150ms 的落位动画才发 finalize，
    // 这段时间里紧接着的一次轻点会被当成"播放"，而不是"勾上"。
    const u = (e: PointerEvent) => {
      const id = liftByPress
      liftByPress = null
      if (id && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) {
        suppressClick()
        longPressSelect(id)
      }
    }
    node.addEventListener('pointerdown', d, true)
    window.addEventListener('pointerup', u, true)
    return () => {
      node.removeEventListener('pointerdown', d, true)
      window.removeEventListener('pointerup', u, true)
    }
  }

  /** 库把被拖的那一行克隆到 body 下面（在 .proto-root 外面），原型的字体、浮起样子要补上 */
  function transformDraggedElement(el?: HTMLElement) {
    if (!el)
      return
    el.classList.add('proto-root', 'dnd-action-ghost')
  }

  const options = $derived({
    items: windowItems,
    flipDurationMs: 150,
    type: 'songs',
    dragDisabled: !sortable,
    morphDisabled: true,
    dropTargetStyle: {},
    delayTouchStart: variant === 'A' ? settings.longPress : false,
    transformDraggedElement,
  })

  const pressOptions = {
    ms: () => settings.longPress,
    // 方案 A 能拖时，长按交给库；其余情况（B/C 的行、不能拖的歌单）长按进入多选
    accept: () => !(variant === 'A' && sortable),
    onPress: (key: string) => longPressSelect(key),
  }
</script>

{#snippet rows()}
  {#each windowItems as item, i (item.id)}
    <div class='arow' animate:flip={{ duration: 150 }}>
      {#if phone}
        <PhoneRow
          song={item.song}
          now={player.current === item.id}
          selecting={selection.mode}
          selected={selection.has(item.id)}
          grip={showGrip}
          attachGrip={showGrip ? gripAttachment : undefined}
          onactivate={e => activateRow(e, item.song, list)}
          rowclick={e => activateRow(e, item.song, list)}
          onmore={e => openMenu(e, item.song)}
          onmenu={e => openMenu(e, item.song)}
        />
      {:else}
        <DesktopRow
          song={item.song}
          n={win.start + i + 1}
          now={player.current === item.id}
          selecting={selection.mode}
          selected={selection.has(item.id)}
          {gripAt}
          attachGrip={showGrip ? gripAttachment : undefined}
          onactivate={e => activateRow(e, item.song, list)}
          rowclick={e => activateRow(e, item.song, list)}
          onmore={e => openMenu(e, item.song)}
          onmenu={e => openMenu(e, item.song)}
        />
      {/if}
    </div>
  {/each}
{/snippet}

{#if handles}
  <div
    bind:this={host}
    class='azone'
    style:padding-top='{win.start * ROW}px'
    style:padding-bottom='{Math.max(0, shown.length - win.end) * ROW}px'
    use:dragHandleZone={options}
    {onconsider}
    {onfinalize}
    aria-label='歌单里的歌曲'
    {@attach track}
    {@attach longPress(pressOptions)}
  >
    {@render rows()}
  </div>
{:else}
  <div
    bind:this={host}
    class='azone'
    style:padding-top='{win.start * ROW}px'
    style:padding-bottom='{Math.max(0, shown.length - win.end) * ROW}px'
    use:dndzone={options}
    {onconsider}
    {onfinalize}
    aria-label='歌单里的歌曲'
    {@attach track}
    {@attach longPress(pressOptions)}
  >
    {@render rows()}
  </div>
{/if}

<style>
  .azone {
    outline: none;
  }

  .arow {
    height: 56px;
  }

  /* 库克隆出来跟手的那一行：白纸 + 浮起阴影。库会把焦点放到克隆体上（只在鼠标、触屏拖动时存在），浏览器默认的蓝色焦点框不要 */
  :global(.dnd-action-ghost) {
    min-height: 0 !important;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
    outline: none;
  }
</style>
