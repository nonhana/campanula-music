<!--
  曲库首页：手机是我喜欢的音乐列表（歌单在“歌单”标签）；桌面是同步提示、我喜欢的音乐的三行歌曲格（“查看全部”进歌单页，
  点一首、播放全部都用整个我喜欢的音乐替换播放队列）和右侧的每日推荐方块、歌单的封面网格和收藏的专辑、歌手两排横向架子。
  返回这一页时，歌单的筛选和滚动位置都回到原来的样子。骨架换成内容时骨架淡出、前几格依次飘入（DESIGN.md Motion）
-->
<script lang='ts'>
  import type { PlaylistFilter } from '#lib/components/library/view.js'
  import { resolve } from '$app/paths'
  import { ChevronLeft, ChevronRight } from '@lucide/svelte'
  import { getAppView } from '#lib/components/app-context.svelte.js'
  import DailyTile from '#lib/components/daily/DailyTile.svelte'
  import { desktopLayout } from '#lib/components/layout.js'
  import CollectedGrid from '#lib/components/library/CollectedGrid.svelte'
  import Cover from '#lib/components/library/Cover.svelte'
  import LikedStates from '#lib/components/library/LikedStates.svelte'
  import PhoneLiked from '#lib/components/library/PhoneLiked.svelte'
  import PlayAllButton from '#lib/components/library/PlayAllButton.svelte'
  import PlaylistGrid from '#lib/components/library/PlaylistGrid.svelte'
  import PlayTarget from '#lib/components/library/PlayTarget.svelte'
  import SkeletonRows from '#lib/components/library/SkeletonRows.svelte'
  import SongBadge from '#lib/components/library/SongBadge.svelte'
  import SongMoreButton from '#lib/components/library/SongMoreButton.svelte'
  import SyncNotice from '#lib/components/library/SyncNotice.svelte'
  import { artistLine, formatCount, langOf, likedView } from '#lib/components/library/view.js'
  import { fade, reveal, scrollBehavior } from '#lib/components/motion.js'
  import NowChip from '#lib/components/player/NowChip.svelte'
  import { currentSong } from '#lib/components/player/view.js'
  import { scrollSnapshot } from '#lib/components/snapshot.js'
  import { openSongMenuAt } from '#lib/components/song-menu.svelte.js'
  import IconButton from '#lib/components/ui/IconButton.svelte'

  const view = getAppView()
  const library = $derived(view.state.library)
  const liked = $derived(library && likedView(library))
  const failureShown = $derived(liked?.kind === 'failed')
  const strip = $derived(liked?.kind === 'songs' ? liked.songs.slice(0, 36) : [])
  const nowId = $derived(currentSong(view.state.player)?.id ?? null)

  let filter = $state<PlaylistFilter>('all')
  /** 手机“我喜欢”标签里的歌单内搜索 */
  let query = $state('')
  export const snapshot = scrollSnapshot(() => ({ filter, query }), (value) => {
    ({ filter, query } = value)
  })

  let stripEl = $state<HTMLElement>()
  /** 歌曲格的封面，按格子的先后：点歌时那一格的封面飞进播放条 */
  const covers = $state<HTMLElement[]>([])
  let atStart = $state(true)
  let atEnd = $state(false)

  function measureStrip() {
    if (!stripEl)
      return
    atStart = stripEl.scrollLeft < 4
    atEnd = stripEl.scrollLeft + stripEl.clientWidth > stripEl.scrollWidth - 4
  }

  // 歌格出现、歌变多、窗口变宽时，翻页键能不能按要跟着变
  $effect(() => {
    void strip.length
    measureStrip()
    window.addEventListener('resize', measureStrip)
    return () => window.removeEventListener('resize', measureStrip)
  })

  function turn(dir: 1 | -1) {
    stripEl?.scrollBy({ left: dir * stripEl.clientWidth, behavior: scrollBehavior() })
  }
</script>

<svelte:head><title>曲库 · Campanula</title></svelte:head>

{#if library && liked}
  {#if desktopLayout.current}
    <h1 class='sr-only'>曲库</h1>
    <!-- 提示和下面的区块隔开 40px：间距算在提示里，提示展开、收起时跟着变 -->
    <SyncNotice {library} {failureShown} class='pb-10' />
    <section aria-labelledby='liked-heading'>
      <div class='mb-4 flex items-center gap-3'>
        <h2 id='liked-heading' class='text-title text-neutral-900 font-600'>我喜欢的音乐</h2>
        <!-- 首数、翻页键、“查看全部”跟着歌一起出现：淡入，不一下冒出来 -->
        {#if liked.kind === 'songs'}
          <span class='text-caption text-neutral-500 tabular-nums' in:fade>{formatCount(liked.total)} 首</span>
        {:else if liked.kind === 'empty'}
          <span class='text-caption text-neutral-500 tabular-nums' in:fade>0 首</span>
        {/if}
        <div class='ml-auto flex items-center gap-2'>
          {#if liked.kind === 'songs'}
            <span class='flex items-center gap-2' in:fade>
              <IconButton icon={ChevronLeft} label='上一页' disabled={atStart} onclick={() => turn(-1)} />
              <IconButton icon={ChevronRight} label='下一页' disabled={atEnd} onclick={() => turn(1)} />
            </span>
          {/if}
          {#if library.liked}
            {@const likedId = library.liked.playlist.id}
            <a href={resolve('/playlists/[id]', { id: String(likedId) })} class='ml-1 h-9 inline-flex items-center rounded-full px-4 text-label text-primary-900 font-500 transition-colors duration-feedback mouse:hover:(bg-primary-100 text-primary-950)' in:fade>查看全部</a>
            <PlayAllButton songs={library.liked.songs} source={{ kind: 'playlist', id: likedId }} />
          {/if}
        </div>
      </div>

      <!-- 窄于 1280px 时方块排到歌曲格下面：并排时歌曲格一屏 3.25 列，每格窄到放不下歌名 -->
      <div class='grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]'>
        <div class='min-w-0 rounded-xl bg-white p-2 shadow-ambient'>
          {#if liked.kind === 'loading'}
            <SkeletonRows count={3} label='正在加载我喜欢的音乐' />
          {:else}
            <div in:reveal>
              {#if liked.kind === 'songs'}
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
                >
                  {#each strip as song, i (song.id)}
                    {@const off = song.availability === 'noCopyright'}
                    {@const now = song.id === nowId}
                    {@const source = { kind: 'playlist', id: library.liked!.playlist.id } as const}
                    <div role='listitem' class={['cell relative h-[60px] rounded-lg', !off && 'mouse:hover:bg-neutral-50']} oncontextmenu={event => openSongMenuAt(event, song, source)}>
                      <div class={['grid grid-cols-[48px_minmax(0,1fr)_32px] h-full items-center gap-3 pl-1.5 pr-1', off && 'opacity-45']}>
                        <span class='relative size-12' bind:this={covers[i]}>
                          <Cover url={song.album.coverUrl} size={48} class='rounded-md' />
                          {#if now}<NowChip />{/if}
                        </span>
                        <PlayTarget class='min-w-0' rounded disabled={off} {now} cover={covers[i]} onplay={() => view.app.play(source, song.id)}>
                          <span class='min-w-0 flex items-center gap-1.5'>
                            <span class={['truncate text-label font-500 transition-colors duration-state', now ? 'text-primary-950' : 'text-neutral-900']} lang={langOf(song.name)}>{song.name}</span>
                            <SongBadge availability={song.availability} />
                          </span>
                          <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
                        </PlayTarget>
                        <SongMoreButton {song} {source} size='cell' />
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <LikedStates {liked} />
              {/if}
            </div>
          {/if}
        </div>
        <DailyTile />
      </div>
    </section>

    <section class='mt-10' aria-labelledby='playlists-heading'>
      <PlaylistGrid {library} bind:filter>
        {#snippet heading()}
          <h2 id='playlists-heading' class='text-title text-neutral-900 font-600'>歌单</h2>
        {/snippet}
      </PlaylistGrid>
    </section>

    <section class='mt-10' aria-labelledby='albums-heading'>
      <div class='mb-4 flex items-center gap-3'>
        <h2 id='albums-heading' class='text-title text-neutral-900 font-600'>专辑</h2>
        {#if library.albums}<span class='text-caption text-neutral-500 tabular-nums' in:fade>{formatCount(library.albums.length)} 张</span>{/if}
      </div>
      <CollectedGrid {library} kind='albums' layout='shelf' />
    </section>

    <section class='mt-10 pb-12' aria-labelledby='artists-heading'>
      <div class='mb-4 flex items-center gap-3'>
        <h2 id='artists-heading' class='text-title text-neutral-900 font-600'>歌手</h2>
        {#if library.artists}<span class='text-caption text-neutral-500 tabular-nums' in:fade>{formatCount(library.artists.length)} 位</span>{/if}
      </div>
      <CollectedGrid {library} kind='artists' layout='shelf' />
    </section>
  {:else}
    <h1 class='sr-only'>我喜欢的音乐</h1>
    <PhoneLiked {library} bind:query />
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
