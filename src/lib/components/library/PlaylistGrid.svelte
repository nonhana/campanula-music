<!--
  曲库里的歌单（自建的、收藏的，不含我喜欢的音乐）：上面一块自建，下面一块收藏，不再合成一张用按钮筛选。
  自建那块右边是“排序”和“新建歌单”（手机只留图标，#57）；“排序”只在自建那块（#37）。点“排序”进入排序模式，点“完成”退出
  （桌面是实心胶囊，手机是文字按钮）；排序时不写使用说明，把手自己说话。
  手机保持横版列表、按每行右边的把手拖；桌面保持原来的封面网格，每张自建歌单封面右上角一个小白圆钮，按住它拖，
  卡片浮起、原位置留薄荷封面空位、其余卡片让位。收藏的歌单在下面，没有把手、不参与排序。
  两块共用 TileGrid 的加载 / 失败 / 空 / 条目状态机；歌单卡本身只有 PlaylistTile 一种画法（#75）。
  骨架换成格子时骨架淡出、前几格依次飘入（DESIGN.md Motion）；手机排序时整个格子先淡出再淡入，不让一个个格子各自挪位。
  heading：歌单页 / 首页歌单区块的区块标题，两块各有自己的分节标题。
-->
<script lang='ts'>
  import { ArrowUpDown, ListMusic, Plus } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import { tick } from 'svelte'
  import { flip } from 'svelte/animate'

  import type { Playlist } from '#lib/api/library.js'
  import type { LibraryState } from '#lib/app/library.js'

  import { getOverlays } from '../overlay/overlay-context'
  import { playlistName } from '../playlist/playlist-text'
  import { getAppView } from '../shared/app-context.svelte'
  import { failureText } from '../shared/failure'
  import { fade, fadeThrough, moveMs, reveal } from '../shared/motion'
  import { DURATIONS } from '../shared/motion-tokens'
  import { formatCount } from '../shared/text'
  import StateBlock from '../ui/StateBlock.svelte'
  import TextButton from '../ui/TextButton.svelte'
  import ToolButton from '../ui/ToolButton.svelte'
  import DragGrip from './DragGrip.svelte'
  import { PlaylistSort } from './playlist-sort.svelte'
  import PlaylistTile from './PlaylistTile.svelte'
  import { tileGridLook } from './tile-grid'
  import TileGrid from './TileGrid.svelte'

  interface Props {
    library: LibraryState
    phone?: boolean
    heading?: Snippet
    /** 首页歌单区块标题 h2、两块 h3；歌单页 h1、两块 h2 */
    sectionLevel?: 2 | 3
  }

  const { library, phone = false, heading, sectionLevel = 2 }: Props = $props()
  const view = getAppView()
  const { playlistEditor, stack } = getOverlays()
  const own = $derived(library.playlists?.filter(playlist => playlist.kind === 'own') ?? null)
  const collected = $derived(library.playlists?.filter(playlist => playlist.kind === 'collected') ?? null)
  /** 只有自建歌单参与；一张、还没有时没有可排的 */
  const canOrder = $derived((own?.length ?? 0) > 1)
  const sectionTag = $derived(`h${sectionLevel}`)
  const desktopGrid = $derived(tileGridLook('playlist', 'grid', false))

  let sorting = $state(false)
  let announcement = $state('')

  const commitOrder = (ids: readonly number[]) => view.app.orderPlaylists(ids)
  /** 手机按横版列表量，桌面按封面网格量（#65） */
  const sort = new PlaylistSort({
    ids: () => own?.map(playlist => playlist.id) ?? [],
    playlistOf: (id: number) => own?.find(playlist => playlist.id === id),
    commit: commitOrder,
    layout: () => phone ? 'rows' : 'grid',
  })
  /** 手机列表、桌面网格共用 */
  const sorted = $derived(sort.order.map(id => own?.find(playlist => playlist.id === id)).filter(playlist => playlist !== undefined))

  $effect(() => () => {
    sort.cancel()
  })

  const startSort = async () => {
    if (!canOrder)
      return
    announcement = `正在排序，共 ${own?.length ?? 0} 张`
    sorting = true
    await tick()
    document.querySelector<HTMLElement>('[data-playlist-sort] a')?.focus()
  }

  const finishSort = async () => {
    sorting = false
    sort.cancel()
    announcement = ''
    await tick()
    document.querySelector<HTMLElement>('[data-sort-entry]')?.focus()
  }

  /** 焦点在哪都行；拖动中的 Esc 由 PlaylistSort 先接住 */
  const onWindowKeydown = (event: KeyboardEvent) => {
    // 有浮层开着时 Esc 先归最上层：浮动菜单不会让背景 inert，只看 inert 不够
    // 也不能让宿主在捕获阶段监听：那会抢在拖动的取消之前
    if (!sorting || stack.top || sort.dragging || event.defaultPrevented || event.key !== 'Escape')
      return
    event.preventDefault()
    void finishSort()
  }

  /** 焦点在某一行时 Alt+↑/↓ 移一位 */
  const onListKeydown = (event: KeyboardEvent) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown'))
      return
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-playlist-id]')
    if (!row)
      return
    const id = Number(row.dataset.playlistId)
    const sorter = sort
    if (!sorter.moveByKeyboard(id, event.key === 'ArrowUp'
      ? -1
      : 1)) {
      return
    }
    event.preventDefault()
    // 卡片换位后浏览器会把焦点丢回 body：等这一帧排好再放回这一张
    void tick().then(() => {
      document.querySelector<HTMLElement>(`[data-playlist-id="${id}"] a`)?.focus()
      const order = sorter.order
      const name = sorter.playlistOf(id)?.name ?? '歌单'
      announcement = `${name}移到第 ${order.indexOf(id) + 1} 张，共 ${order.length} 张`
    })
  }

  const EMPTY = { own: '还没有自建歌单', collected: '还没有收藏的歌单' }
</script>

{#snippet ownTile(playlist: Playlist)}
  <PlaylistTile
    id={playlist.id}
    name={playlistName(playlist)}
    coverUrl={playlist.coverUrl}
    trackCount={playlist.trackCount}
    creator={null}
    locked={playlist.private}
    {phone}
  />
{/snippet}

<svelte:window onkeydown={onWindowKeydown} />

{#if heading}
  <div class={['mb-3 flex items-center gap-3', phone && 'px-4 pt-3']}>{@render heading()}</div>
{/if}

{#if own === null && library.sync.status === 'failed'}
  <div in:reveal><StateBlock kind='error' title='歌单列表没能同步' body={failureText(library.sync.failure)} action={{
    label: '重试',
    run: () => view.app.retrySync(),
  }} /></div>
{:else}
  {#if sorting}
    <p class='sr-only' aria-live='polite'>{announcement}</p>
  {/if}
  <section aria-labelledby='own-playlists-heading'>
    <div class={['mb-3 flex items-center gap-3', phone && 'px-4 pt-3']}>
      <svelte:element this={sectionTag} id='own-playlists-heading' class='text-title-sm text-neutral-900 font-600'>自建歌单</svelte:element>
      {#if own !== null}
        <span class='text-caption text-neutral-500 tabular-nums'>{formatCount(own.length)} 张</span>
      {/if}
      {#if sorting}
        <TextButton strong desktop={{ variant: 'primary' }} class='ml-auto max-md:-mr-3' onclick={finishSort}>完成</TextButton>
      {:else}
        <div class='ml-auto flex items-center gap-2 max-md:-mr-3'>
          {#if canOrder}
            <ToolButton icon={ArrowUpDown} label='排序自建歌单' text='排序' onclick={startSort} data-sort-entry />
          {/if}
          <ToolButton icon={Plus} label='新建歌单' onclick={event => playlistEditor.open({ mode: 'new', songs: [], from: event.currentTarget })} />
        </div>
      {/if}
    </div>

    {#if own === null}
      <TileGrid kind='playlist' layout='grid' {phone} items={null} label='自建歌单' loadingLabel='正在加载自建歌单'>
        {#snippet tile(playlist: Playlist)}{@render ownTile(playlist)}{/snippet}
      </TileGrid>
    {:else if phone}
      {#key sorting ? 'sort' : 'own'}
        <div transition:fadeThrough>
          {#if sorting}
            <ul
              class='w-full flex flex-col gap-2 px-4 pb-8'
              aria-label='自建歌单，正在排序'
              data-playlist-sort
            >
              {#each sorted as playlist (playlist.id)}
                <li data-playlist-id={playlist.id} class='relative' animate:flip={{
                  duration: moveMs(DURATIONS.state),
                }}>
                  <div class={[
                    'h-14 flex items-center gap-3 rounded-xl pl-3 pr-2',
                    sort.lifted(playlist.id)
                      ? 'bg-primary-100'
                      : 'bg-white shadow-ambient',
                  ]}>
                    <div class={['flex min-w-0 flex-1 items-center gap-3', sort.lifted(playlist.id) && 'pointer-events-none opacity-0']}>
                      <PlaylistTile
                        id={playlist.id}
                        name={playlistName(playlist)}
                        coverUrl={playlist.coverUrl}
                        trackCount={playlist.trackCount}
                        creator={null}
                        locked={playlist.private}
                        look='row'
                        onkeydown={onListKeydown}
                      />
                      <DragGrip label={playlistName(playlist)} size='phone' attach={sort.handle(playlist.id)} onkeydown={onListKeydown} />
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
          {:else}
            <TileGrid kind='playlist' layout='grid' {phone} items={own} label='自建歌单' loadingLabel='正在加载自建歌单' empty={{ icon: ListMusic, title: EMPTY.own }}>
              {#snippet tile(playlist: Playlist)}{@render ownTile(playlist)}{/snippet}
            </TileGrid>
          {/if}
        </div>
      {/key}
    {:else if sorting}
      <ul
        class={['grid', desktopGrid.list]}
        aria-label='自建歌单，正在排序'
        data-playlist-sort
      >
        {#each sorted as playlist (playlist.id)}
          <li data-playlist-id={playlist.id} class='relative min-w-0' animate:flip={{
            duration: moveMs(DURATIONS.state),
          }}>
            <div class={['transition-opacity', sort.lifted(playlist.id) && 'pointer-events-none opacity-0']}>
              <PlaylistTile
                id={playlist.id}
                name={playlistName(playlist)}
                coverUrl={playlist.coverUrl}
                trackCount={playlist.trackCount}
                creator={null}
                locked={playlist.private}
                onkeydown={onListKeydown}
              />
            </div>
            {#if sort.lifted(playlist.id)}
              <div class='pointer-events-none absolute inset-x-0 top-0 aspect-square rounded-lg bg-primary-100'></div>
            {/if}
            <span
              class={['absolute right-2 top-2 z-10', sort.lifted(playlist.id) && 'pointer-events-none opacity-0']}
              in:fade={{ duration: DURATIONS.feedback }}
            >
              <DragGrip label={playlistName(playlist)} size='desktop' overlay attach={sort.handle(playlist.id)} onkeydown={onListKeydown} />
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <TileGrid kind='playlist' layout='grid' {phone} items={own} label='自建歌单' loadingLabel='正在加载自建歌单' empty={{ icon: ListMusic, title: EMPTY.own }}>
        {#snippet tile(playlist: Playlist)}{@render ownTile(playlist)}{/snippet}
      </TileGrid>
    {/if}
  </section>

  <section class='mt-8' aria-labelledby='collected-playlists-heading'>
    <div class={['mb-3 flex items-center gap-3', phone && 'px-4 pt-3']}>
      <svelte:element this={sectionTag} id='collected-playlists-heading' class='text-title-sm text-neutral-900 font-600'>收藏的歌单</svelte:element>
      {#if collected !== null}
        <span class='text-caption text-neutral-500 tabular-nums'>{formatCount(collected.length)} 张</span>
      {/if}
    </div>

    <TileGrid kind='playlist' layout='grid' {phone} items={collected} label='收藏的歌单' loadingLabel='正在加载收藏的歌单' empty={{ icon: ListMusic, title: EMPTY.collected }}>
      {#snippet tile(playlist: Playlist)}
        <PlaylistTile
          id={playlist.id}
          name={playlistName(playlist)}
          coverUrl={playlist.coverUrl}
          trackCount={playlist.trackCount}
          creator={playlist.creator}
          locked={playlist.private}
          {phone}
        />
      {/snippet}
    </TileGrid>
  </section>
{/if}

{#if phone && (sort.dragging || sort.settling) && sort.grabbed}
  <div
    class={['pointer-events-none fixed left-0 top-0 z-50', sort.settling && 'transition-transform duration-move-state ease-out-soft']}
    style:left='{sort.ghost.x}px'
    style:width='{sort.ghost.width}px'
    style:transform='translate3d(0, {sort.settling ? sort.settleY : sort.ghost.y}px, 0)'
    aria-hidden='true'
    inert={true}
  >
    <div class='h-14 flex items-center gap-3 rounded-xl bg-white pl-3 pr-2 shadow-float'>
      <PlaylistTile
        id={sort.grabbed.id}
        name={playlistName(sort.grabbed)}
        coverUrl={sort.grabbed.coverUrl}
        trackCount={sort.grabbed.trackCount}
        creator={null}
        locked={sort.grabbed.private}
        look='row'
      />
      <DragGrip label={sort.grabbed.name} size='phone' ghost />
    </div>
  </div>
{:else if !phone && (sort.dragging || sort.settling) && sort.grabbed}
  <div
    class={['pointer-events-none fixed left-0 top-0 z-50', sort.settling && 'transition-transform duration-move-state ease-out-soft']}
    style:width='{sort.ghost.width}px'
    style:transform='translate3d({sort.settling ? sort.settleX : sort.ghost.x}px, {sort.settling ? sort.settleY : sort.ghost.y}px, 0)'
    aria-hidden='true'
    inert={true}
  >
    <div class='relative rounded-xl bg-white p-2 shadow-float'>
      <PlaylistTile
        id={sort.grabbed.id}
        name={playlistName(sort.grabbed)}
        coverUrl={sort.grabbed.coverUrl}
        trackCount={sort.grabbed.trackCount}
        creator={null}
        locked={sort.grabbed.private}
        flight={false}
      />
      <span class='absolute right-4 top-4 z-10'>
        <DragGrip label={sort.grabbed.name} size='desktop' overlay ghost />
      </span>
    </div>
  </div>
{/if}
