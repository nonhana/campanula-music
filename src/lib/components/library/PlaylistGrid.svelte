<!--
  曲库里的歌单（自建的、收藏的，不含我喜欢的音乐）：上面一块自建，下面一块收藏，不再合成一张用按钮筛选。
  自建那块右边是“排序”和“新建歌单”（手机只留图标，#57）；“排序”只在自建那块（#37）。点“排序”进入排序模式，点“完成”退出
  （桌面是实心胶囊，手机是文字按钮）；排序时不写使用说明，把手自己说话。
  手机保持横版列表、按每行右边的把手拖；桌面保持原来的封面网格，每张自建歌单封面右上角一个小白圆钮，按住它拖，
  卡片浮起、原位置留薄荷封面空位、其余卡片让位。收藏的歌单在下面，没有把手、不参与排序。
  歌单列表还没拿到时两块都是骨架，没拿到就出错时能重试，一块一张都没有时只有一行标题。
  骨架换成格子时骨架淡出、前几格依次飘入（DESIGN.md Motion）；手机换筛选/排序时整个格子先淡出再淡入，不让一个个格子各自挪位
  （DESIGN.md Overlays · 筛选）。heading：歌单页 / 首页歌单区块的区块标题，两块各有自己的分节标题。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { Playlist } from '#lib/api/library.js'
  import type { LibraryState } from '#lib/app/library.js'
  import { resolve } from '$app/paths'
  import { ArrowUpDown, ListMusic, Lock, Plus } from '@lucide/svelte'
  import { tick } from 'svelte'
  import { flip } from 'svelte/animate'
  import { getAppView } from '../app-context.svelte'
  import { failureText } from '../failure'
  import { fade, fadeAway, fadeThrough, moveMs, reveal } from '../motion'
  import { DURATIONS } from '../motion-tokens'
  import { getOverlays } from '../overlay-context'
  import StateBlock from '../ui/StateBlock.svelte'
  import TextButton from '../ui/TextButton.svelte'
  import ToolButton from '../ui/ToolButton.svelte'
  import Cover from './Cover.svelte'
  import DragGrip from './DragGrip.svelte'
  import { PlaylistSort } from './playlist-sort.svelte'
  import PlaylistTile from './PlaylistTile.svelte'
  import TileBone from './TileBone.svelte'
  import { FLIGHT_COVER_SIZE, formatCount, langOf, playlistName } from './view'

  interface Props {
    library: LibraryState
    phone?: boolean
    heading?: Snippet
    /** 分节标题的级数：首页歌单区块的标题是 h2，两块用 h3；歌单页是 h1，两块用 h2 */
    sectionLevel?: 2 | 3
  }

  const { library, phone = false, heading, sectionLevel = 2 }: Props = $props()
  const view = getAppView()
  const { playlistEditor, stack } = getOverlays()
  const own = $derived(library.playlists?.filter(playlist => playlist.kind === 'own') ?? null)
  const collected = $derived(library.playlists?.filter(playlist => playlist.kind === 'collected') ?? null)
  /** 只有自建歌单参与排序；一张、还没有时没有可排的 */
  const canOrder = $derived((own?.length ?? 0) > 1)
  const sectionTag = $derived(`h${sectionLevel}`)
  /** 骨架和真的网格一样排（DESIGN.md Do's：形状一致的骨架） */
  const gridClass = $derived(['grid', phone ? 'grid-cols-2 gap-x-3 gap-y-5 px-4 pt-4' : 'grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-x-5 gap-y-6'])

  let sorting = $state(false)
  /** 键盘移动后给读屏的一句话 */
  let announcement = $state('')

  const commitOrder = (ids: readonly number[]) => {
    const liked = library.playlists?.find(playlist => playlist.kind === 'liked')
    return liked ? view.app.orderPlaylists([liked.id, ...ids]) : false
  }
  /** 一个排序器：手机按横版列表量，桌面按封面网格量（#65） */
  const sort = new PlaylistSort({
    ids: () => own?.map(playlist => playlist.id) ?? [],
    playlistOf: (id: number) => own?.find(playlist => playlist.id === id),
    commit: commitOrder,
    layout: () => phone ? 'rows' : 'grid',
  })
  /** 排序时的自建歌单预览（手机列表、桌面网格共用） */
  const sorted = $derived(sort.order.map(id => own?.find(playlist => playlist.id === id)).filter(playlist => playlist !== undefined))

  $effect(() => () => {
    sort.cancel()
  })

  async function startSort() {
    if (!canOrder)
      return
    announcement = `正在排序，共 ${own?.length ?? 0} 张`
    sorting = true
    await tick()
    document.querySelector<HTMLElement>('[data-playlist-sort] a')?.focus()
  }

  async function finishSort() {
    sorting = false
    sort.cancel()
    announcement = ''
    await tick()
    document.querySelector<HTMLElement>('[data-sort-entry]')?.focus()
  }

  /** 排序期间按 Esc 退出（焦点在哪都行；拖动中的 Esc 由 PlaylistSort 先接住） */
  function onWindowKeydown(event: KeyboardEvent) {
    // 有浮层开着时 Esc 先归最上层：浮动菜单不会让背景 inert，只看 inert 不够。
    // 也不能改成让宿主在捕获阶段监听：那会抢在拖动的取消之前。
    if (!sorting || stack.top || sort.dragging || event.defaultPrevented || event.key !== 'Escape')
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
    const sorter = sort
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

  /** 一块一张都没有：标题说清了，不写正文 */
  const EMPTY = { own: '还没有自建歌单', collected: '还没有收藏的歌单' }
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

{#if heading}
  <div class={['mb-3 flex items-center gap-3', phone && 'px-4 pt-3']}>{@render heading()}</div>
{/if}

{#if own === null && library.sync.status === 'failed'}
  <div in:reveal><StateBlock kind='error' title='歌单列表没能同步' body={failureText(library.sync.failure)} action={{ label: '重试', run: () => view.app.retrySync() }} /></div>
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
      <div class={gridClass} role='status' aria-busy='true' aria-label='正在加载自建歌单' out:fadeAway>
        {#each { length: phone ? 4 : 6 }, i (i)}
          <TileBone {phone} />
        {/each}
      </div>
    {:else}
      <div in:reveal>
        {#if phone}
          {#key sorting ? 'sort' : 'own'}
            <div transition:fadeThrough>
              {#if sorting}
                <ul
                  class='w-full flex flex-col gap-2 px-4 pb-8'
                  aria-label='自建歌单，正在排序'
                  data-playlist-sort
                >
                  {#each sorted as playlist (playlist.id)}
                    <li data-playlist-id={playlist.id} class='relative' animate:flip={{ duration: moveMs(DURATIONS.state) }}>
                      <div class={['h-14 flex items-center gap-3 rounded-xl pl-3 pr-2', sort.lifted(playlist.id) ? 'bg-primary-100' : 'bg-white shadow-ambient']}>
                        <div class={['flex min-w-0 flex-1 items-center gap-3', sort.lifted(playlist.id) && 'pointer-events-none opacity-0']}>
                          <a href={resolve('/playlists/[id=neteaseId]', { id: playlist.id })} class='min-w-0 flex flex-1 items-center gap-3 rounded-lg' onkeydown={onListKeydown}>
                            {@render sortRow(playlist)}
                          </a>
                          <DragGrip label={playlistName(playlist)} size='phone' attach={sort.handle(playlist.id)} onkeydown={onListKeydown} />
                        </div>
                      </div>
                    </li>
                  {/each}
                </ul>
              {:else if own.length === 0}
                <StateBlock kind='empty' icon={ListMusic} title={EMPTY.own} />
              {:else}
                <ul class={gridClass} aria-label='自建歌单' data-reveal-group>
                  {#each own as playlist (playlist.id)}
                    <li class='min-w-0'>
                      <PlaylistTile
                        id={playlist.id}
                        name={playlistName(playlist)}
                        coverUrl={playlist.coverUrl}
                        trackCount={playlist.trackCount}
                        creator={null}
                        locked={playlist.private}
                        phone
                      />
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/key}
        {:else}
          {#if own.length === 0}
            <StateBlock kind='empty' icon={ListMusic} title={EMPTY.own} />
          {:else}
            <ul
              class={gridClass}
              aria-label={sorting ? '自建歌单，正在排序' : '自建歌单'}
              data-playlist-sort
              data-reveal-group
            >
              {#each (sorting ? sorted : own) as playlist (playlist.id)}
                {@const ownCard = sorting}
                <li data-playlist-id={ownCard ? playlist.id : undefined} class='relative min-w-0' animate:flip={{ duration: moveMs(DURATIONS.state) }}>
                  <div class={['transition-opacity', ownCard && sort.lifted(playlist.id) && 'pointer-events-none opacity-0']}>
                    <PlaylistTile
                      id={playlist.id}
                      name={playlistName(playlist)}
                      coverUrl={playlist.coverUrl}
                      trackCount={playlist.trackCount}
                      creator={null}
                      locked={playlist.private}
                      onkeydown={ownCard ? onListKeydown : undefined}
                    />
                  </div>
                  {#if ownCard && sort.lifted(playlist.id)}
                    <div class='pointer-events-none absolute inset-x-0 top-0 aspect-square rounded-lg bg-primary-100'></div>
                  {/if}
                  {#if ownCard}
                    <span
                      class={['absolute right-2 top-2 z-10', sort.lifted(playlist.id) && 'pointer-events-none opacity-0']}
                      in:fade={{ duration: DURATIONS.feedback }}
                    >
                      <DragGrip label={playlistName(playlist)} size='desktop' overlay attach={sort.handle(playlist.id)} onkeydown={onListKeydown} />
                    </span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </div>
    {/if}
  </section>

  <section class='mt-8' aria-labelledby='collected-playlists-heading'>
    <div class={['mb-3 flex items-center gap-3', phone && 'px-4 pt-3']}>
      <svelte:element this={sectionTag} id='collected-playlists-heading' class='text-title-sm text-neutral-900 font-600'>收藏的歌单</svelte:element>
      {#if collected !== null}
        <span class='text-caption text-neutral-500 tabular-nums'>{formatCount(collected.length)} 张</span>
      {/if}
    </div>

    {#if collected === null}
      <div class={gridClass} role='status' aria-busy='true' aria-label='正在加载收藏的歌单' out:fadeAway>
        {#each { length: phone ? 4 : 6 }, i (i)}
          <TileBone {phone} />
        {/each}
      </div>
    {:else if collected.length === 0}
      <div in:reveal><StateBlock kind='empty' icon={ListMusic} title={EMPTY.collected} /></div>
    {:else}
      <div in:reveal>
        <ul class={gridClass} aria-label='收藏的歌单' data-reveal-group>
          {#each collected as playlist (playlist.id)}
            <li class='min-w-0'>
              <PlaylistTile
                id={playlist.id}
                name={playlistName(playlist)}
                coverUrl={playlist.coverUrl}
                trackCount={playlist.trackCount}
                creator={playlist.creator}
                locked={playlist.private}
                {phone}
              />
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </section>
{/if}

{#if phone && (sort.dragging || sort.settling) && sort.grabbed}
  <div
    class={['pointer-events-none fixed left-0 top-0 z-50', sort.settling && 'transition-transform duration-move-state ease-out-soft']}
    style:left='{sort.ghost.x}px'
    style:width='{sort.ghost.width}px'
    style:transform='translate3d(0, {sort.settling ? sort.settleY : sort.ghost.y}px, 0)'
    aria-hidden='true'
  >
    <div class='h-14 flex items-center gap-3 rounded-xl bg-white pl-3 pr-2 shadow-float'>
      {@render sortRow(sort.grabbed)}
      <DragGrip label={sort.grabbed.name} size='phone' ghost />
    </div>
  </div>
{:else if !phone && (sort.dragging || sort.settling) && sort.grabbed}
  <div
    class={['pointer-events-none fixed left-0 top-0 z-50', sort.settling && 'transition-transform duration-move-state ease-out-soft']}
    style:width='{sort.ghost.width}px'
    style:transform='translate3d({sort.settling ? sort.settleX : sort.ghost.x}px, {sort.settling ? sort.settleY : sort.ghost.y}px, 0)'
    aria-hidden='true'
  >
    <div class='relative rounded-xl bg-white p-2 shadow-float'>
      {@render sortGridCard(sort.grabbed)}
      <span class='absolute right-4 top-4 z-10'>
        <DragGrip label={sort.grabbed.name} size='desktop' overlay ghost />
      </span>
    </div>
  </div>
{/if}
