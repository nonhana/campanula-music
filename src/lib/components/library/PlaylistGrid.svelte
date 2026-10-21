<!--
  曲库里的歌单（自建的、收藏的，不含我喜欢的音乐）：全部 / 自建 / 收藏 筛选加封面网格，筛选右边是“新建歌单”（#33，打开 PlaylistEditor）。
  #37：点“排序”进入排序模式，点“完成”退出；我喜欢的音乐固定在最前，收藏的歌单不参与。
  手机保持横版列表、按每行右边的把手拖；桌面保持原来的封面网格，每张封面右上角一个小白圆钮，按住它拖，
  卡片浮起、原位置留薄荷封面空位、其余卡片让位。
  手机的歌单标签和桌面首页的歌单区块共用；歌单列表还没拿到时是骨架，没拿到就出错时能重试，筛完一张都没有时说明。
  骨架换成格子时骨架淡出、前几格依次飘入（DESIGN.md Motion）；换筛选时整个格子先淡出再淡入，不让一个个格子各自挪位
  （DESIGN.md Overlays · 筛选）。heading：桌面放在筛选左边的区块标题
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { Playlist } from '#lib/api/library.js'
  import type { LibraryState } from '#lib/app/library.js'
  import type { PlaylistFilter } from './view'
  import { resolve } from '$app/paths'
  import { ArrowUpDown, Check, ListMusic, Lock, Plus } from '@lucide/svelte'
  import { tick } from 'svelte'
  import { flip } from 'svelte/animate'
  import { getAppView } from '../app-context.svelte'
  import { failureText } from '../failure'
  import { fade, fadeAway, fadeThrough, moveMs, reveal } from '../motion'
  import { DURATIONS } from '../motion-tokens'
  import { playlistEditor } from '../playlist-edit.svelte'
  import Button from '../ui/Button.svelte'
  import FilterChip from '../ui/FilterChip.svelte'
  import StateBlock from '../ui/StateBlock.svelte'
  import Cover from './Cover.svelte'
  import DragGrip from './DragGrip.svelte'
  import { PlaylistGridSort } from './playlist-grid-sort.svelte'
  import { PlaylistSort } from './playlist-sort.svelte'
  import PlaylistTile from './PlaylistTile.svelte'
  import TileBone from './TileBone.svelte'
  import { filterPlaylists, FLIGHT_COVER_SIZE, formatCount, langOf, PLAYLIST_FILTERS, playlistName } from './view'

  interface Props {
    library: LibraryState
    filter: PlaylistFilter
    phone?: boolean
    heading?: Snippet
  }

  let { library, filter = $bindable(), phone = false, heading }: Props = $props()
  const view = getAppView()
  const shown = $derived(library.playlists && filterPlaylists(library.playlists, filter))
  const own = $derived(library.playlists?.filter(playlist => playlist.kind === 'own') ?? null)
  /** 只有自建歌单参与排序；一张、还没有时没有可排的 */
  const canOrder = $derived((own?.length ?? 0) > 1)
  /** 手机是列表右边，桌面是卡片右上角；一句就够，桌面放在标题行里，不把网格往下推 */
  const hint = $derived(phone
    ? '按住右边的把手拖动，点“完成”退出；收藏的歌单不参与。'
    : '按住右上角把手拖动，点“完成”退出；收藏的歌单不参与。')
  /** 骨架和真的网格一样排（DESIGN.md Do's：形状一致的骨架） */
  const gridClass = $derived(['grid', phone ? 'grid-cols-2 gap-x-3 gap-y-5 px-4 pt-4' : 'grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-x-5 gap-y-6'])

  let sorting = $state(false)
  /** 进入排序前在哪个筛选：点“完成”回到那里 */
  let filterBefore: PlaylistFilter | null = null
  /** 键盘移动后给读屏的一句话 */
  let announcement = $state('')

  const commitOrder = (ids: readonly number[]) => {
    const liked = library.playlists?.find(playlist => playlist.kind === 'liked')
    return liked ? view.app.orderPlaylists([liked.id, ...ids]) : false
  }
  const sortOptions = {
    ids: () => own?.map(playlist => playlist.id) ?? [],
    playlistOf: (id: number) => own?.find(playlist => playlist.id === id),
    commit: commitOrder,
  }
  /** 手机：横版列表的拖动 */
  const sort = new PlaylistSort(sortOptions)
  /** 桌面：封面网格的拖动 */
  const gridSort = new PlaylistGridSort(sortOptions)
  /** 排序时显示的歌单：拖动的预览顺序，或者 App 里的顺序 */
  const sorted = $derived(sort.order.map(id => own?.find(playlist => playlist.id === id)).filter(playlist => playlist !== undefined))
  const gridSorted = $derived(gridSort.order.map(id => own?.find(playlist => playlist.id === id)).filter(playlist => playlist !== undefined))
  /**
   * 桌面排序时收藏的歌单还显示在原地（只是没有把手、不能拖），所以进入排序不会把整页刷新一遍；
   * 自建歌单按预览顺序排在前面，收藏的接在后面
   */
  const gridItems = $derived(sorting && !phone ? [...gridSorted, ...(shown?.filter(playlist => playlist.kind === 'collected') ?? [])] : shown ?? [])

  $effect(() => () => {
    sort.cancel()
    gridSort.cancel()
  })

  async function startSort() {
    if (!canOrder || filter === 'collected')
      return
    // 桌面保持当前筛选：网格里的卡片不动，只把把手浮出来；手机要换成列表，才先切到自建
    if (phone) {
      filterBefore = filter
      filter = 'own'
    }
    announcement = `正在排序，共 ${own?.length ?? 0} 张`
    sorting = true
    await tick()
    document.querySelector<HTMLElement>('[data-playlist-sort] a')?.focus()
  }

  async function finishSort() {
    sorting = false
    sort.cancel()
    gridSort.cancel()
    if (phone && filterBefore)
      filter = filterBefore
    filterBefore = null
    announcement = ''
    await tick()
    document.querySelector<HTMLElement>('[data-sort-entry]')?.focus()
  }

  /** 排序期间按 Esc 退出（焦点在哪都行；拖动中的 Esc 由 PlaylistSort 先接住） */
  function onWindowKeydown(event: KeyboardEvent) {
    if (!sorting || sort.dragging || gridSort.dragging || event.defaultPrevented || event.key !== 'Escape')
      return
    event.preventDefault()
    void finishSort()
  }

  /** 焦点在某一行时 Alt + ↑ / ↓ 移一位 */
  function onListKeydown(event: KeyboardEvent) {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown'))
      return
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-playlist-id]')
    if (!row)
      return
    const id = Number(row.dataset.playlistId)
    const sorter = phone ? sort : gridSort
    if (!sorter.moveByKeyboard(id, event.key === 'ArrowUp' ? -1 : 1))
      return
    event.preventDefault()
    // 卡片换了位置以后浏览器会把焦点丢回 body：等这一帧排好，再把焦点放回这一张
    void tick().then(() => {
      document.querySelector<HTMLElement>(`[data-playlist-id="${id}"] a`)?.focus()
      const order = sorter.order
      const name = sorter.playlistOf(id)?.name ?? '歌单'
      announcement = `${name}移到第 ${order.indexOf(id) + 1} 张，共 ${order.length} 张`
    })
  }

  const EMPTY = {
    all: { title: '曲库里还没有歌单', body: '点“新建歌单”建一张；在网易云音乐里新建或收藏的歌单也会同步到这里。' },
    own: { title: '还没有自建歌单', body: '点“新建歌单”建一张；在网易云音乐里新建的歌单也会同步到这里。' },
    collected: { title: '还没有收藏的歌单', body: '在网易云音乐里收藏的歌单，会同步到这里。' },
  }
</script>

{#snippet sortGridCard(playlist: Playlist)}
  <Cover url={playlist.coverUrl} size={FLIGHT_COVER_SIZE} fluid class='rounded-lg shadow-ambient' />
  <span class='mt-2.5 block truncate text-label text-neutral-900 font-500' lang={langOf(playlist.name)}>{playlistName(playlist)}</span>
  <span class='mt-0.5 min-w-0 flex items-center gap-1 text-caption text-neutral-600'>
    <span class='flex-none tabular-nums'>{formatCount(playlist.trackCount)} 首</span>
    {#if playlist.private}
      <Lock size={12} class='flex-none' aria-hidden='true' /><span class='sr-only'>隐私歌单</span>
    {/if}
  </span>
{/snippet}

{#snippet sortRow(playlist: Playlist)}
  <Cover url={playlist.coverUrl} size={40} class='rounded-md' />
  <span class='min-w-0 flex-1'>
    <span class='block truncate text-label text-neutral-900 font-500' lang={langOf(playlist.name)}>{playlistName(playlist)}</span>
    <span class='mt-0.5 flex items-center gap-1 text-caption text-neutral-600'>
      <span class='flex-none tabular-nums'>{formatCount(playlist.trackCount)} 首</span>
      {#if playlist.private}
        <Lock size={12} class='flex-none' aria-hidden='true' /><span class='sr-only'>隐私歌单</span>
      {/if}
    </span>
  </span>
{/snippet}

<svelte:window onkeydown={onWindowKeydown} />

{#if sorting}
  <div class={['flex items-center', phone ? 'gap-2 px-4 pt-3' : 'mb-4 gap-4']}>
    {#if phone}
      <h2 class='text-title-sm text-neutral-900 font-600'>自建歌单</h2>
    {:else}
      {@render heading?.()}
    {/if}
    <span class='text-caption text-neutral-500 tabular-nums'>{phone ? '' : '自建歌单 · '}{own?.length ?? 0} 张</span>
    {#if !phone}
      <p class='min-w-0 flex-1 truncate text-caption text-neutral-600'>{hint}</p>
    {/if}
    <Button variant='primary' icon={Check} class='ml-auto' onclick={finishSort}>完成</Button>
  </div>
  {#if phone}
    <p class='px-4 pb-4 pt-2 text-caption text-neutral-600'>{hint}</p>
  {/if}
{:else}
  <div class={['flex items-center', phone ? 'gap-2 px-4 pt-3' : 'mb-4 gap-4']}>
    {@render heading?.()}
    <div class='flex gap-2' role='group' aria-label='筛选歌单'>
      {#each PLAYLIST_FILTERS as item (item.key)}
        <FilterChip selected={filter === item.key} onclick={() => (filter = item.key)}>{item.label}</FilterChip>
      {/each}
    </div>
    <div class='ml-auto flex items-center gap-2'>
      {#if !phone && canOrder && filter !== 'collected'}
        <Button variant='outline' icon={ArrowUpDown} onclick={startSort} data-sort-entry>排序</Button>
      {/if}
      <Button variant='outline' icon={Plus} onclick={event => playlistEditor.open({ mode: 'new', songs: [], from: event.currentTarget })}>新建歌单</Button>
    </div>
  </div>
  {#if phone && canOrder && filter !== 'collected'}
    <div class='flex items-center gap-3 px-4 pt-2'>
      <p class='min-w-0 flex-1 text-caption text-neutral-600'>我喜欢的音乐固定在最前，收藏的歌单不参与排序。</p>
      <Button variant='outline' icon={ArrowUpDown} onclick={startSort} data-sort-entry>排序</Button>
    </div>
  {/if}
{/if}

<!-- 骨架和出错、内容放在同一串分支里：骨架换成内容时，骨架的淡出、内容的飘入才会播放 -->
{#if shown === null && library.sync.status === 'failed'}
  <div in:reveal><StateBlock kind='error' title='歌单列表没能同步' body={failureText(library.sync.failure)} action={{ label: '重试', run: () => view.app.retrySync() }} /></div>
{:else if shown === null}
  <div class={gridClass} role='status' aria-busy='true' aria-label='正在加载歌单' out:fadeAway>
    {#each { length: phone ? 4 : 6 }, i (i)}
      <TileBone {phone} />
    {/each}
  </div>
{:else}
  <div in:reveal>
    <!-- 新旧两份格子叠在同一格里：换筛选的这一会儿高度按高的那份算，淡完旧的才换成新的高度 -->
    <div class='grid grid-cols-[minmax(0,1fr)]'>
      {#key phone ? (sorting ? 'sort' : filter) : filter}
        <div class='col-start-1 row-start-1 min-w-0' transition:fadeThrough>
          {#if phone && sorting}
            <p class='sr-only' aria-live='polite'>{announcement}</p>
            <ul
              class='w-full flex flex-col gap-2 px-4 pb-8'
              aria-label='自建歌单，正在排序'
              data-playlist-sort
              {@attach sort.container}
            >
              {#each sorted as playlist (playlist.id)}
                <li data-playlist-id={playlist.id} class='relative' animate:flip={{ duration: moveMs(DURATIONS.state) }}>
                  <div class={['h-14 flex items-center gap-3 rounded-xl pl-3 pr-2', sort.lifted(playlist.id) ? 'bg-primary-100' : 'bg-white shadow-ambient']}>
                    <div class={['flex min-w-0 flex-1 items-center gap-3', sort.lifted(playlist.id) && 'pointer-events-none opacity-0']}>
                      <a href={resolve('/playlists/[id]', { id: String(playlist.id) })} class='min-w-0 flex flex-1 items-center gap-3 rounded-lg' onkeydown={onListKeydown}>
                        {@render sortRow(playlist)}
                      </a>
                      <DragGrip label={playlistName(playlist)} size='phone' attach={sort.handle(playlist.id)} onkeydown={onListKeydown} />
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
          {:else if shown.length === 0}
            <StateBlock kind='empty' icon={ListMusic} title={EMPTY[filter].title} body={EMPTY[filter].body} />
          {:else}
            <!-- 排序时还是这同一个网格：自建卡片按预览顺序，收藏的留在后面不动；只多出把手 -->
            <ul
              class={gridClass}
              aria-label={sorting ? '自建歌单，正在排序' : '歌单'}
              data-playlist-sort
              data-reveal-group
              {@attach gridSort.container}
            >
              {#each gridItems as playlist (playlist.id)}
                {@const ownCard = sorting && !phone && playlist.kind === 'own'}
                <li data-playlist-id={ownCard ? playlist.id : undefined} class='relative min-w-0' animate:flip={{ duration: moveMs(DURATIONS.state) }}>
                  <div class={['transition-opacity', ownCard && gridSort.lifted(playlist.id) && 'pointer-events-none opacity-0']}>
                    <PlaylistTile
                      id={playlist.id}
                      name={playlistName(playlist)}
                      coverUrl={playlist.coverUrl}
                      trackCount={playlist.trackCount}
                      creator={playlist.kind === 'collected' ? playlist.creator : null}
                      locked={playlist.private}
                      {phone}
                      onkeydown={ownCard ? onListKeydown : undefined}
                    />
                  </div>
                  {#if ownCard && gridSort.lifted(playlist.id)}
                    <div class='pointer-events-none absolute inset-x-0 top-0 aspect-square rounded-lg bg-primary-100'></div>
                  {/if}
                  {#if ownCard}
                    <span
                      class={['absolute right-2 top-2 z-10', gridSort.lifted(playlist.id) && 'pointer-events-none opacity-0']}
                      in:fade={{ duration: DURATIONS.feedback }}
                    >
                      <DragGrip label={playlistName(playlist)} size='desktop' overlay attach={gridSort.handle(playlist.id)} onkeydown={onListKeydown} />
                    </span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/key}
    </div>
  </div>
{/if}

{#if phone && (sort.dragging || sort.settling) && sort.grabbed}
  <div
    class='pointer-events-none fixed left-0 top-0 z-50'
    style:left='{sort.ghostLeft}px'
    style:width='{sort.ghostWidth}px'
    style:transform='translate3d(0, {sort.settling ? sort.settleY : sort.ghostY}px, 0)'
    class:transition-transform={sort.settling}
    class:duration-move-state={sort.settling}
    class:ease-out-soft={sort.settling}
    aria-hidden='true'
  >
    <div class='h-14 flex items-center gap-3 rounded-xl bg-white pl-3 pr-2 shadow-float'>
      {@render sortRow(sort.grabbed)}
      <DragGrip label={sort.grabbed.name} size='phone' ghost />
    </div>
  </div>
{:else if !phone && (gridSort.dragging || gridSort.settling) && gridSort.grabbed}
  <div
    class='pointer-events-none fixed left-0 top-0 z-50'
    style:width='{gridSort.ghostWidth}px'
    style:transform='translate3d({gridSort.settling ? gridSort.settleX : gridSort.ghostX}px, {gridSort.settling ? gridSort.settleY : gridSort.ghostY}px, 0)'
    class:transition-transform={gridSort.settling}
    class:duration-move-state={gridSort.settling}
    class:ease-out-soft={gridSort.settling}
    aria-hidden='true'
  >
    <div class='relative rounded-xl bg-white p-2 shadow-float'>
      {@render sortGridCard(gridSort.grabbed)}
      <span class='absolute right-4 top-4 z-10'>
        <DragGrip label={gridSort.grabbed.name} size='desktop' overlay ghost />
      </span>
    </div>
  </div>
{/if}
