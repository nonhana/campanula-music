<!--
  PROTOTYPE：曲库里的“歌单”——自建歌单之间的排序（我喜欢的音乐固定在最前，收藏的歌单不参与）。
  方案 A：长按封面格子直接拖（桌面按住拖）。方案 B：封面角上常驻把手。方案 C：点“排序”换成紧凑列表，每行右边有把手。
  三种实现：自写（gridSort）、svelte-dnd-action（dndzone，格子也能用）、dnd-kit（createSortable）。
  顺序一次提交全部自建歌单的编号（playlist_order_update），连续拖动同样合并提交。
-->
<script lang='ts'>
  import type { DragEndEvent, DragOverEvent } from '@dnd-kit/dom'
  import type { DndEvent } from 'svelte-dnd-action'
  import type { Playlist } from '../data'
  import { AutoScroller } from '@dnd-kit/dom'
  import { DragDropProvider } from '@dnd-kit/svelte'
  import { isSortable as isKitSortable } from '@dnd-kit/svelte/sortable'
  import { ArrowUpDown, Check, Heart, Lock } from '@lucide/svelte'
  import { flip } from 'svelte/animate'
  import { fromAction } from 'svelte/attachments'
  import { dndzone, dragHandle, dragHandleZone } from 'svelte-dnd-action'
  import Cover from '../Cover.svelte'
  import { formatCount, langOf } from '../data'
  import { suppressClick, vibrate } from '../interact'
  import { layout as screen } from '../layout.svelte'
  import { openPlaylist } from '../nav'
  import { settings } from '../settings.svelte'
  import { library, tracksOf, view } from '../store.svelte'
  import { gridSort } from './gridSort'
  import KitTile from './KitTile.svelte'
  import PlaylistTile from './PlaylistTile.svelte'

  const phone = $derived(screen.phone)
  const variant = $derived(view.dragVariant)
  let sorting = $state(false)
  const listMode = $derived(variant === 'C' && sorting)
  const tileLayout = $derived<'grid' | 'list'>(listMode ? 'list' : 'grid')
  const grip = $derived(variant === 'B' || listMode)
  const canSort = $derived(variant !== 'C' || sorting)

  // ── 自写 ──
  let preview = $state.raw<string[] | null>(null)
  let lifted = $state<null | { id: string, left: number, top: number, width: number }>(null)
  let offset = $state({ dx: 0, dy: 0 })
  let settling = $state(false)
  const pointerOrder = $derived(preview ?? library.ownOrder)

  function onLift(id: string | null, rect?: DOMRect) {
    if (id && rect) {
      lifted = { id, left: rect.left, top: rect.top, width: rect.width }
      offset = { dx: 0, dy: 0 }
      settling = false
      return
    }
    // 放下：浮层滑进空位（170ms），再换回真正的格子
    const cur = lifted
    if (!cur)
      return
    const slot = document.querySelector<HTMLElement>(`[data-sort-key="${cur.id}"]`)?.getBoundingClientRect()
    if (slot) {
      settling = true
      offset = { dx: slot.left - cur.left, dy: slot.top - cur.top }
    }
    setTimeout(() => {
      if (lifted === cur) {
        lifted = null
        settling = false
      }
    }, slot ? 180 : 0)
  }

  const pointerSort = gridSort({
    order: () => library.ownOrder,
    preview: ids => (preview = ids),
    commit: (ids, moved) => {
      preview = null
      if (moved)
        library.setOwnOrder(ids)
    },
    handleOnly: () => grip,
    longPress: () => settings.longPress,
    insets: () => ({ top: screen.phone ? 56 : 64, bottom: screen.phone ? 84 : 80 }),
    onLift,
    onMove: (dx, dy) => (offset = { dx, dy }),
  })

  // ── svelte-dnd-action ──
  interface Item { id: string, pl: Playlist }
  let actionItems = $state.raw<Item[] | null>(null)
  const shownAction = $derived(actionItems ?? library.own.map(pl => ({ id: pl.id, pl })))
  const gripAttachment = fromAction(dragHandle)

  function consider(e: CustomEvent<DndEvent<Item>>) {
    actionItems = e.detail.items
  }

  function finalize(e: CustomEvent<DndEvent<Item>>) {
    const ids = e.detail.items.map(i => i.id)
    actionItems = null
    suppressClick()
    if (ids.join() !== library.ownOrder.join())
      library.setOwnOrder(ids)
  }

  /** 库把被拖的格子克隆到 body 下面（.proto-root 外面）：补上字体；.proto-root 的整屏最小高度要去掉，否则克隆体的中心偏到格子外面，库就认不出拖到了哪里 */
  function liftActionGhost(el?: HTMLElement) {
    if (!el)
      return
    el.classList.add('proto-root', 'dnd-tile-ghost')
    el.querySelector('.tile, .lrow')?.classList.add('is-ghost')
  }

  const actionOptions = $derived({
    items: shownAction,
    flipDurationMs: 180,
    type: 'own-playlists',
    dragDisabled: !canSort,
    dropTargetStyle: {},
    delayTouchStart: grip ? false : settings.longPress,
    transformDraggedElement: liftActionGhost,
  })

  // ── dnd-kit ──
  let kitOrder = $state.raw<string[] | null>(null)
  const shownKit = $derived((kitOrder ?? library.ownOrder).map(id => library.byId(id)).filter((p): p is Playlist => Boolean(p)))
  const kitPlugins = $derived((defaults: any[]) => [
    ...defaults.filter(p => p !== AutoScroller),
    AutoScroller.configure({ acceleration: settings.maxSpeed / 60, threshold: { x: 0, y: 0.15 } }),
  ])

  function kitStart() {
    kitOrder = library.ownOrder
    vibrate(10)
  }

  function kitOver(event: DragOverEvent) {
    const { source, target } = event.operation
    if (!kitOrder || !isKitSortable(source) || !isKitSortable(target))
      return
    const from = kitOrder.indexOf(String(source.id))
    const to = kitOrder.indexOf(String(target.id))
    if (from < 0 || to < 0 || from === to)
      return
    const next = [...kitOrder]
    next.splice(from, 1)
    next.splice(to, 0, String(source.id))
    kitOrder = next
  }

  function kitEnd(event: DragEndEvent) {
    const ids = kitOrder
    kitOrder = null
    suppressClick()
    if (!event.canceled && ids && ids.join() !== library.ownOrder.join())
      library.setOwnOrder(ids)
  }

  const gridClass = $derived(listMode
    ? ['flex flex-col gap-2', !phone && 'max-w-[720px]']
    : phone ? 'grid grid-cols-2 gap-x-3 gap-y-5' : 'grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-x-5 gap-y-6')

  const commitStatus = $derived(library.ownCommit.status)
  const liftedPl = $derived(lifted ? library.byId(lifted.id) : undefined)
</script>

{#snippet staticTile(pl: Playlist, liked: boolean)}
  <button type='button' class='static block min-w-0 text-left' onclick={() => openPlaylist(pl.id)}>
    <span class='relative block'>
      <Cover cover={library.coverOf(pl)} class='w-full rounded-xl shadow-ambient' />
      {#if liked}
        <span class='absolute bottom-2 left-2 grid size-8 place-items-center rounded-full bg-white/92 shadow-ambient'><Heart size={16} class='text-accent-600' fill='currentColor' aria-hidden='true' /></span>
      {/if}
    </span>
    <span class={['mt-2 block truncate font-500 text-neutral-900', phone ? 'text-[15px]' : 'mt-2.5 text-[14px]']} lang={langOf(pl.name)}>{pl.name}</span>
    <span class={['mt-0.5 flex min-w-0 items-center gap-1 text-neutral-600', phone ? 'text-[13px]' : 'text-[12.5px]']}>
      <span class='flex-none tnum'>{formatCount(tracksOf(pl.id).local.length)} 首</span>
      {#if pl.isPrivate}<Lock size={12} aria-label='隐私' />{/if}
      {#if pl.kind === 'collected'}<span class='truncate' lang={langOf(pl.creator)}>· {pl.creator}</span>{/if}
    </span>
  </button>
{/snippet}

<section class={phone ? 'px-4 pb-8 pt-2' : 'pb-12'} aria-labelledby='lib-own'>
  <div class={['flex items-center gap-3', phone ? 'mb-2 min-h-11' : 'mb-3', listMode && !phone && 'max-w-[720px]']}>
    <h2 id='lib-own' class={['font-600 text-neutral-900', phone ? 'text-[18px] leading-7' : 'text-[20px] leading-7']}>自建歌单</h2>
    <span class='text-[13px] text-neutral-600 tnum' role='status'>
      {library.own.length} 张{#if commitStatus === 'waiting'} · 顺序待保存{:else if commitStatus === 'saving'} · 正在保存顺序{/if}
    </span>
    {#if variant === 'C'}
      <button
        class={['sort-btn ml-auto inline-flex h-9 items-center gap-1.5 rounded-full pl-3 pr-4 text-[14px] font-500', sorting ? 'bg-primary-900 text-white' : 'border border-neutral-200 bg-white text-neutral-800']}
        aria-pressed={sorting}
        onclick={() => (sorting = !sorting)}
      >
        {#if sorting}<Check size={16} aria-hidden='true' />完成{:else}<ArrowUpDown size={16} aria-hidden='true' />排序{/if}
      </button>
    {/if}
  </div>
  <!-- 两句话之间不能换行：模板里的换行会变成一个空格，中文句号后面多一个空格很显眼 -->
  <p class='mb-4 max-w-[48em] text-[13px] leading-5 text-neutral-600'>
    {#if variant === 'A'}{phone ? '长按一张歌单，浮起后拖到想放的位置。' : '按住一张歌单拖到想放的位置。'}{:else if variant === 'B'}按住封面角上的把手拖动。{:else if sorting}按住右边的把手拖动，排好后点“完成”。{:else}点“排序”调整自建歌单的顺序。{/if}我喜欢的音乐固定在最前面，收藏的歌单不参与排序。
  </p>

  {#if !listMode}
    <div class={['mb-5', gridClass]}>
      {@render staticTile(library.liked, true)}
    </div>
  {/if}

  {#if view.engine === 'action'}
    {#if grip}
      <div class={gridClass} use:dragHandleZone={actionOptions} onconsider={consider} onfinalize={finalize} aria-label='自建歌单'>
        {#each shownAction as item (item.id)}
          <div animate:flip={{ duration: 180 }}>
            <PlaylistTile pl={item.pl} layout={tileLayout} {phone} grip attachGrip={gripAttachment} onopen={() => openPlaylist(item.id)} />
          </div>
        {/each}
      </div>
    {:else}
      <div class={gridClass} use:dndzone={actionOptions} onconsider={consider} onfinalize={finalize} aria-label='自建歌单'>
        {#each shownAction as item (item.id)}
          <div animate:flip={{ duration: 180 }}>
            <PlaylistTile pl={item.pl} layout={tileLayout} {phone} rowclick={canSort} onopen={() => openPlaylist(item.id)} />
          </div>
        {/each}
      </div>
    {/if}
  {:else if view.engine === 'kit'}
    <DragDropProvider plugins={kitPlugins} onDragStart={kitStart} onDragOver={kitOver} onDragEnd={kitEnd}>
      <div class={gridClass} aria-label='自建歌单'>
        {#each shownKit as pl, i (pl.id)}
          <KitTile {pl} index={i} layout={tileLayout} {phone} {grip} disabled={!canSort} onopen={() => openPlaylist(pl.id)} />
        {/each}
      </div>
    </DragDropProvider>
  {:else}
    <div class={gridClass} aria-label='自建歌单' {@attach canSort ? pointerSort : undefined}>
      {#each pointerOrder as id (id)}
        {@const pl = library.byId(id)}
        {#if pl}
          <div data-sort-key={id} class={['slot rounded-xl', lifted?.id === id && 'is-placeholder']}>
            <PlaylistTile {pl} layout={tileLayout} {phone} {grip} onopen={() => openPlaylist(id)} />
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  {#if !listMode}
    <h2 class={['font-600 text-neutral-900', phone ? 'mb-3 mt-8 text-[18px] leading-7' : 'mb-4 mt-12 text-[20px] leading-7']}>收藏的歌单</h2>
    <div class={gridClass}>
      {#each library.collected as pl (pl.id)}
        {@render staticTile(pl, false)}
      {/each}
    </div>
  {/if}
</section>

{#if lifted && liftedPl}
  <div
    class={['lift-ghost', settling && 'is-settling']}
    style:left='{lifted.left}px'
    style:top='{lifted.top}px'
    style:width='{lifted.width}px'
    style:transform='translate3d({offset.dx}px, {offset.dy}px, 0)'
    aria-hidden='true'
  >
    <PlaylistTile pl={liftedPl} layout={tileLayout} {phone} {grip} ghost={!settling} />
  </div>
{/if}

<style>
  /* 自写引擎：被拖的那张原位留一个浅薄荷色的空位 */
  .slot.is-placeholder {
    background: #e8f8f1;
  }

  .slot.is-placeholder > :global(*) {
    opacity: 0;
  }

  /* 库会把焦点放到克隆体上（只在鼠标、触屏拖动时存在），浏览器默认的蓝色焦点框不要 */
  :global(.dnd-tile-ghost) {
    min-height: 0 !important;
    outline: none;
  }

  .lift-ghost {
    position: fixed;
    z-index: 60;
    pointer-events: none;
    will-change: transform;
  }

  .lift-ghost.is-settling {
    transition: transform 170ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  @media (hover: hover) and (pointer: fine) {
    .static:hover :global(img) {
      box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .lift-ghost.is-settling {
      transition: none;
    }
  }
</style>
