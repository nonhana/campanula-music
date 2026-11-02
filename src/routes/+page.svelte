<!--
  曲库首页：手机是我喜欢的音乐列表（歌单在“歌单”标签）；桌面是曲库的目录（作者 2026-11-01 定）：同步提示、我喜欢的音乐三行歌曲格（“查看全部”进歌单页）
  和右侧的每日推荐方块，下面自建歌单、收藏的歌单、专辑、歌手各一个横向架子，放全部、能用鼠标拖着滚（作者 2026-11-02 定），
  标题写总数，“查看全部”进歌单、专辑、歌手页（这一类空时没有）。自建歌单的排序在歌单页。滚动位置随浏览历史恢复。
  歌曲格和歌曲行共用 songs/SongTitle；歌曲格的歌手名能点（#84），歌手一行连同下载标记画在点歌按钮外面（CreditLine）。能不能放读 App 的答案（songLook）。
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { ChevronLeft, ChevronRight, Heart, ListMusic, Plus } from '@lucide/svelte'
  import type { Snippet } from 'svelte'

  import type { Playlist } from '#lib/api/library.js'
  import { playlistName } from '#lib/api/library.js'
  import { playlistGroups, syncNoticeFor } from '#lib/app/library.js'
  import DailyTile from '#lib/components/daily/DailyTile.svelte'
  import CollectedGrid from '#lib/components/library/CollectedGrid.svelte'
  import { likedFailure } from '#lib/components/library/liked-failure.js'
  import PlaylistSongs from '#lib/components/library/PlaylistSongs.svelte'
  import PlaylistTile from '#lib/components/library/PlaylistTile.svelte'
  import SyncNotice from '#lib/components/library/SyncNotice.svelte'
  import TileGrid from '#lib/components/library/TileGrid.svelte'
  import { songMenuActions } from '#lib/components/menu/song-menu.svelte.js'
  import { getOverlays } from '#lib/components/overlay/overlay-context.js'
  import { currentSong } from '#lib/components/player/now.js'
  import { getAppView } from '#lib/components/shared/app-context.svelte.js'
  import { dragScroll } from '#lib/components/shared/drag-scroll.js'
  import { failureText } from '#lib/components/shared/failure.js'
  import { desktopLayout } from '#lib/components/shared/layout.js'
  import { fade, reveal, scrollBehavior } from '#lib/components/shared/motion.js'
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js'
  import { formatCount } from '#lib/components/shared/text.js'
  import CreditLine from '#lib/components/songs/CreditLine.svelte'
  import DownloadMark from '#lib/components/songs/DownloadMark.svelte'
  import NowChip from '#lib/components/songs/NowChip.svelte'
  import PlayAllButton from '#lib/components/songs/PlayAllButton.svelte'
  import PlayTarget from '#lib/components/songs/PlayTarget.svelte'
  import SkeletonRows from '#lib/components/songs/SkeletonRows.svelte'
  import { songLook } from '#lib/components/songs/song-look.js'
  import SongMoreButton from '#lib/components/songs/SongMoreButton.svelte'
  import SongTitle from '#lib/components/songs/SongTitle.svelte'
  import Cover from '#lib/components/ui/Cover.svelte'
  import IconButton from '#lib/components/ui/IconButton.svelte'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'
  import TextButton from '#lib/components/ui/TextButton.svelte'
  import ToolButton from '#lib/components/ui/ToolButton.svelte'

  const view = getAppView()
  const { openSongMenuAt } = songMenuActions()
  const { playlistEditor } = getOverlays()
  const library = $derived(view.state.library)
  const likedId = $derived(library?.liked?.playlist.id ?? 0)
  const liked = $derived(library?.playlistPage(likedId) ?? null)
  /** 首页 liked 只有整块列表失败时才算“失败已说明”；部分歌的失败仍由同步条（首次同步）或提示条说 */
  const notice = $derived(library && liked
    ? syncNoticeFor(library, liked.failure?.where === 'list')
    : null)
  const strip = $derived(liked?.songs.kind === 'songs'
    ? liked.songs.songs.slice(0, 36)
    : [])
  const nowId = $derived(currentSong(view.state.player)?.id ?? null)
  /** 自建按听众排好的先后（不含我喜欢的音乐），收藏的照网易云给的 */
  const groups = $derived(library?.playlists
    ? playlistGroups(library.playlists)
    : null)
  const own = $derived(groups?.own ?? null)
  const collected = $derived(groups?.collected ?? null)

  const newPlaylist = (event: MouseEvent & { currentTarget: HTMLButtonElement }) => {
    playlistEditor.open({ mode: 'new', songs: [], from: event.currentTarget })
  }

  /** 歌单列表没同步到就停下了：两排各自说明、能重试 */
  const listFailure = (title: string) => library?.sync.status === 'failed'
    ? {
      title,
      body: failureText(library.sync.failure),
      retry: () => view.app.retrySync(),
    }
    : null

  /** 手机“我喜欢”标签里的歌单内搜索 */
  let query = $state('')
  scrollSnapshot('/', () => query, (value) => {
    query = value
  })

  let stripEl = $state<HTMLElement>()
  /** 歌曲格的封面，按格子的先后：点歌时那一格的封面飞进播放条 */
  const covers = $state<HTMLElement[]>([])
  let atStart = $state(true)
  let atEnd = $state(false)

  const measureStrip = () => {
    if (!stripEl)
      return
    atStart = stripEl.scrollLeft < 4
    atEnd = stripEl.scrollLeft + stripEl.clientWidth > stripEl.scrollWidth - 4
  }

  $effect(() => {
    void strip.length
    measureStrip()
  })

  const turn = (dir: 1 | -1) => {
    stripEl?.scrollBy({
      left: dir * stripEl.clientWidth,
      behavior: scrollBehavior(),
    })
  }

  /** 我喜欢的音乐整块失败：同步失败重新同步，打开失败再打开这张歌单（拿不到资料时退回重新同步） */
  const retryLiked = () => {
    if (!liked?.failure)
      return
    const action = likedFailure(liked.failure)
    if (action.retry === 'open' && liked.info)
      void view.app.openPlaylist(liked.info.id)
    else
      view.app.retrySync()
  }
</script>

<svelte:window onresize={measureStrip} />

<svelte:head><title>曲库 · Campanula</title></svelte:head>

{#snippet likedStates()}
  {#if liked?.failure}
    {@const action = likedFailure(liked.failure)}
    <StateBlock kind='error' title={action.title} body={failureText(liked.failure.failure)} action={{ label: '重试', run: retryLiked }} />
  {:else}
    <StateBlock kind='empty' icon={Heart} title='还没有红心的歌' />
  {/if}
{/snippet}

{#snippet seeAll(href: string)}
  <!-- 跟着列表一起淡入，不一下冒出来 -->
  <span class='ml-1' in:fade><TextButton {href} class='md:h-9 md:px-4'>查看全部</TextButton></span>
{/snippet}

{#snippet rowHead(id: string, title: string, count: string | null, all: string | null, tools?: Snippet)}
  <!-- 至少和按钮一样高（40px）：数量、“查看全部”跟着列表一起出现时，下面的东西不被往下推 -->
  <div class='mb-4 min-h-10 flex items-center gap-3'>
    <h2 {id} class='text-title text-neutral-900 font-600'>{title}</h2>
    {#if count !== null}<span class='text-caption text-neutral-500 tabular-nums' in:fade>{count}</span>{/if}
    <div class='ml-auto flex items-center gap-2'>
      {@render tools?.()}
      {#if all !== null}{@render seeAll(all)}{/if}
    </div>
  </div>
{/snippet}

{#snippet newPlaylistButton()}
  <ToolButton icon={Plus} label='新建歌单' onclick={newPlaylist} />
{/snippet}

{#if library && liked}
  {#if desktopLayout.current}
    <h1 class='sr-only'>曲库</h1>
    <!-- 提示和下面的区块隔开 40px：间距算在提示里，提示展开、收起时跟着变 -->
    <SyncNotice {notice} class='pb-10' />
    <section aria-labelledby='liked-heading'>
      <!-- 至少和翻页键一样高（40px）：键跟着歌一起出现时，下面的东西不被往下推 -->
      <div class='mb-4 min-h-10 flex items-center gap-3'>
        <h2 id='liked-heading' class='text-title text-neutral-900 font-600'>我喜欢的音乐</h2>
        <!-- 首数、翻页键、“查看全部”跟着歌一起出现：淡入，不一下冒出来 -->
        {#if liked.songs.kind === 'songs'}
          <span class='text-caption text-neutral-500 tabular-nums' in:fade>{formatCount(liked.songs.total)} 首</span>
        {/if}
        <div class='ml-auto flex items-center gap-2'>
          {#if liked.songs.kind === 'songs'}
            <span class='flex items-center gap-2' in:fade>
              <IconButton icon={ChevronLeft} label='上一页' disabled={atStart} onclick={() => turn(-1)} />
              <IconButton icon={ChevronRight} label='下一页' disabled={atEnd} onclick={() => turn(1)} />
            </span>
          {/if}
          {#if library.liked}
            {@const likedId = library.liked.playlist.id}
            {@render seeAll(resolve('/playlists/[id=neteaseId]', { id: likedId }))}
            <PlayAllButton songs={library.liked.songs} source={{ kind: 'playlist', id: likedId }} />
          {/if}
        </div>
      </div>

      <!-- 窄于 1280px 时方块排到歌曲格下面：并排时歌曲格一屏 3.25 列，每格窄到放不下歌名 -->
      <div class='grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]'>
        <div class='min-w-0 rounded-xl bg-white p-2 shadow-ambient'>
          {#if liked.songs.kind === 'loading' && liked.failure?.where !== 'list'}
            <!-- 和歌曲格一样排成 3 行、每行 60px（.strip），歌出来时面板不变高 -->
            <SkeletonRows count={3} label='正在加载我喜欢的音乐' class='grid grid-rows-[repeat(3,60px)] items-center' />
          {:else}
            <div in:reveal>
              {#if liked.songs.kind === 'songs'}
                <!-- 能横向滚动的容器 Chrome 会放进 Tab 顺序：给它名字，键盘焦点在上面时 ←/→ 也能翻 -->
                <div
                  bind:this={stripEl}
                  class='strip'
                  role='list'
                  aria-label='我喜欢的音乐的前 {strip.length} 首'
                  style:--fade-l={atStart ? '0px' : '32px'}
                  style:--fade-r={atEnd ? '0px' : '48px'}
                  onscroll={measureStrip}
                  data-reveal-group
                  {@attach dragScroll}
                >
                  {#each strip as song, i (song.id)}
                    {@const look = songLook(view, song)}
                    {@const off = look.off}
                    {@const now = song.id === nowId}
                    {@const source = { kind: 'playlist', id: library.liked!.playlist.id } as const}
                    <div role='listitem' class={['cell relative h-[60px] rounded-lg', !off && 'mouse:hover:bg-neutral-50']} oncontextmenu={event => openSongMenuAt(event, song, source)}>
                      <div class={['grid grid-cols-[48px_minmax(0,1fr)_32px] h-full items-center gap-3 pl-1.5 pr-1', off && 'opacity-45']}>
                        <span class='relative size-12' bind:this={covers[i]}>
                          <Cover url={song.album.coverUrl} size={48} class='rounded-md' />
                          {#if now}<NowChip />{/if}
                        </span>
                        <span class='min-w-0'>
                          <PlayTarget class='block w-full' rounded disabled={off} {now} cover={covers[i]} onplay={() => view.app.play(source, song.id)}>
                            <SongTitle {song} {now} {look} mark tight creditsOutside />
                          </PlayTarget>
                          <span class='flex items-center gap-1.5 text-caption text-neutral-600' aria-hidden='true'>
                            {#if look.mark}<DownloadMark mark={look.mark} variant='inline' />{/if}
                            <CreditLine artists={song.artists} linked class='min-w-0 truncate' />
                          </span>
                        </span>
                        <SongMoreButton {song} {source} size='cell' />
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                {@render likedStates()}
              {/if}
            </div>
          {/if}
        </div>
        <DailyTile />
      </div>
    </section>

    <section class='mt-10' aria-labelledby='own-heading'>
      {@render rowHead('own-heading', '自建歌单', own && `${formatCount(own.length)} 张`, own && own.length > 0
        ? resolve('/playlists')
        : null, newPlaylistButton)}
      <TileGrid kind='playlist' layout='shelf' items={own} label='自建歌单' loadingLabel='正在加载自建歌单' failure={listFailure('自建歌单没能同步')} empty={{ icon: ListMusic, title: '还没有自建歌单' }}>
        {#snippet tile(playlist: Playlist)}
          <PlaylistTile id={playlist.id} name={playlistName(playlist)} coverUrl={playlist.coverUrl} trackCount={library.songCountOf(playlist.id)} creator={null} locked={playlist.private} />
        {/snippet}
      </TileGrid>
    </section>

    <section class='mt-10' aria-labelledby='collected-heading'>
      <!-- 收藏的“查看全部”直接停在歌单页的收藏那块 -->
      {@render rowHead('collected-heading', '收藏的歌单', collected && `${formatCount(collected.length)} 张`, collected && collected.length > 0
        ? `${resolve('/playlists')}#collected-playlists-heading`
        : null)}
      <TileGrid kind='playlist' layout='shelf' items={collected} label='收藏的歌单' loadingLabel='正在加载收藏的歌单' failure={listFailure('收藏的歌单没能同步')} empty={{ icon: ListMusic, title: '还没有收藏的歌单' }}>
        {#snippet tile(playlist: Playlist)}
          <PlaylistTile id={playlist.id} name={playlistName(playlist)} coverUrl={playlist.coverUrl} trackCount={library.songCountOf(playlist.id)} creator={playlist.creator} locked={playlist.private} />
        {/snippet}
      </TileGrid>
    </section>

    <section class='mt-10' aria-labelledby='albums-heading'>
      {@render rowHead('albums-heading', '收藏的专辑', library.albums && `${formatCount(library.albums.length)} 张`, (library.albums?.length ?? 0) > 0
        ? resolve('/albums')
        : null)}
      <CollectedGrid {library} kind='albums' layout='shelf' />
    </section>

    <section class='mt-10 pb-12' aria-labelledby='artists-heading'>
      {@render rowHead('artists-heading', '收藏的歌手', library.artists && `${formatCount(library.artists.length)} 位`, (library.artists?.length ?? 0) > 0
        ? resolve('/artists')
        : null)}
      <CollectedGrid {library} kind='artists' layout='shelf' />
    </section>
  {:else}
    <h1 class='sr-only'>我喜欢的音乐</h1>
    <SyncNotice {notice} phone />
    <PlaylistSongs {library} playlistId={likedId} bind:query phone />
  {/if}
{/if}

<style>
  .strip {
    display: grid;
    grid-template-rows: repeat(3, 60px);
    grid-auto-flow: column;
    grid-auto-columns: calc((100% - 24px) / 3.25);
    column-gap: 8px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    /* 露出的半列淡进面板里，读作“还有更多”，不是被截断 */
    mask-image: linear-gradient(90deg, transparent 0, #000 var(--fade-l), #000 calc(100% - var(--fade-r)), transparent 100%);
  }

  .cell {
    scroll-snap-align: start;
  }
</style>
