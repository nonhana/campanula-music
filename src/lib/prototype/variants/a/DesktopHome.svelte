<!--
  PROTOTYPE：变体 A 的桌面曲库首屏——整个曲库的分区总览：首次同步、我喜欢的音乐（三行歌曲格 + 每日推荐）、歌单、专辑、歌手。
  ?demo=loading | empty | error 演示“我喜欢的音乐”面板的加载中、空、出错。
-->
<script lang='ts'>
  import type { PlaylistFilter } from './state.svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { albums, artistLine, artists, daily, firstSync, formatCount, langOf, LIKED_TOTAL, likedSongs } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { ChevronLeft, ChevronRight, Ellipsis, Heart, Lock, Play, Plus, RefreshCw } from '@lucide/svelte'
  import DownloadMark from './DownloadMark.svelte'
  import InlineMore from './InlineMore.svelte'
  import MorningWash from './MorningWash.svelte'
  import NowChip from './NowChip.svelte'
  import SkeletonRows from './SkeletonRows.svelte'
  import SongBadges from './SongBadges.svelte'
  import StateBlock from './StateBlock.svelte'
  import { dailyDay, filterPlaylists, isNow, likedSource, playDaily, playlistFilters, ui } from './state.svelte'

  const strip = likedSongs.slice(0, 36)
  const syncPct = Math.round((firstSync.tracksDone / firstSync.tracksTotal) * 100)

  let filter = $state<PlaylistFilter>('all')
  const shown = $derived(filterPlaylists(filter))

  let stripEl = $state<HTMLElement>()
  let atStart = $state(true)
  let atEnd = $state(false)

  function onStripScroll() {
    if (!stripEl)
      return
    atStart = stripEl.scrollLeft < 4
    atEnd = stripEl.scrollLeft + stripEl.clientWidth > stripEl.scrollWidth - 4
  }

  function page(dir: 1 | -1) {
    stripEl?.scrollBy({ left: dir * stripEl.clientWidth, behavior: 'smooth' })
  }

  function playLiked(i: number) {
    player.playFrom(likedSongs, i, likedSource)
  }
</script>

{#snippet heading(id: string, title: string, count?: string)}
  <h2 {id} class='scroll-mt-[96px] text-[20px] leading-7 font-600 text-neutral-900'>{title}</h2>
  {#if count}<span class='text-[14px] text-neutral-500 tnum'>{count}</span>{/if}
{/snippet}

{#snippet likedEmptyBody()}在任何一首歌的<InlineMore />菜单里点“红心”，它就会出现在这里。{/snippet}

<!-- 首次同步（离线时暂停） -->
<div class='flex h-14 items-center gap-4 rounded-2xl bg-white px-5 shadow-ambient' role='status'>
  <RefreshCw size={18} class={['flex-none', nav.offline ? 'text-neutral-500' : 'spin text-primary-800']} aria-hidden='true' />
  <p class='flex-none text-[14px] font-500 text-neutral-900'>
    {nav.offline ? '同步已暂停' : '正在同步曲库'}<span class='ml-2 font-400 text-neutral-600'>{nav.offline ? '联网后接着同步' : '已同步的部分可以先搜'}</span>
  </p>
  <span class='h-4 w-px flex-none bg-neutral-200' aria-hidden='true'></span>
  <p class='min-w-0 flex-1 truncate text-[13px] text-neutral-600'>
    <span class='tnum'>歌单 {firstSync.playlistsDone} / {firstSync.playlistsTotal} · 曲目 {formatCount(firstSync.tracksDone)} / {formatCount(firstSync.tracksTotal)}</span>
    {#if !nav.offline}· 正在同步「{firstSync.current}」{/if}
  </p>
  <span class='relative h-1 w-40 flex-none overflow-hidden rounded-full bg-primary-100' aria-hidden='true'>
    <span class='absolute inset-y-0 left-0 rounded-full bg-primary-700' style:width='{syncPct}%'></span>
  </span>
  <span class='w-9 flex-none text-right text-[13px] text-neutral-600 tnum'>{syncPct}%</span>
</div>

<!-- 我喜欢的音乐 -->
<section class='mt-10' aria-labelledby='a-liked'>
  <div class='mb-4 flex items-center gap-3'>
    {@render heading('a-liked', '我喜欢的音乐', `${formatCount(LIKED_TOTAL)} 首`)}
    <div class='ml-auto flex items-center gap-2'>
      <button class='pill-ghost grid size-9 place-items-center rounded-full text-neutral-700 disabled:opacity-35' aria-label='上一页' disabled={atStart} onclick={() => page(-1)}>
        <ChevronLeft size={18} aria-hidden='true' />
      </button>
      <button class='pill-ghost grid size-9 place-items-center rounded-full text-neutral-700 disabled:opacity-35' aria-label='下一页' disabled={atEnd} onclick={() => page(1)}>
        <ChevronRight size={18} aria-hidden='true' />
      </button>
      <button class='pill-ghost ml-1 h-9 rounded-full px-4 text-[14px] font-500 text-primary-900' onclick={() => nav.openPlaylist('liked')}>查看全部</button>
      <button class='pill-filled inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-900 pl-3.5 pr-4 text-[14px] font-500 text-white' onclick={() => playLiked(0)}>
        <Play size={15} fill='currentColor' aria-hidden='true' />播放全部
      </button>
    </div>
  </div>

  <div class='grid grid-cols-[minmax(0,1fr)_280px] gap-5'>
    <div class='min-w-0 rounded-2xl bg-white p-2 shadow-ambient'>
      {#if nav.demo === 'loading'}
        <SkeletonRows count={3} label='正在加载我喜欢的音乐' />
      {:else if nav.demo === 'empty'}
        <StateBlock compact kind='empty' icon={Heart} title='还没有红心的歌' body={likedEmptyBody} actionLabel='去搜一首' onaction={() => nav.openSearch()} />
      {:else if nav.demo === 'error'}
        <StateBlock compact kind='error' title='我喜欢的音乐没能同步' body='网络不太稳定。已经同步的歌照常能听、能搜。' actionLabel='重试' onaction={() => (nav.demo = '')} />
      {:else}
      <div
        bind:this={stripEl}
        class='strip'
        style:--fade-l={atStart ? '0px' : '32px'}
        style:--fade-r={atEnd ? '0px' : '48px'}
        onscroll={onStripScroll}
      >
        {#each strip as song, i (song.id)}
          {@const now = isNow(likedSongs, i, song)}
          <div
            class={['cell relative h-[60px] rounded-xl', !player.playable(song) && 'is-off']}
            role='presentation'
            oncontextmenu={e => ui.openMenuAt(song, e, { onplay: () => playLiked(i) })}
          >
            {#if now}<MorningWash start={58} />{/if}
            <div class='relative grid h-full grid-cols-[48px_minmax(0,1fr)_32px] items-center gap-3 pl-1.5 pr-1'>
              <span class='relative size-12'>
                <Cover cover={song.cover} class='size-12 rounded-lg' />
                {#if now}<NowChip />{/if}
              </span>
              <button
                class='play-target min-w-0 text-left'
                disabled={!player.playable(song)}
                aria-current={now ? 'true' : undefined}
                onclick={() => playLiked(i)}
              >
                <span class='flex min-w-0 items-center gap-1.5'>
                  <span class={['truncate text-[14px] leading-5 font-500', now ? 'text-primary-950' : 'text-neutral-900']} lang={song.lang}>{song.title}</span>
                  <SongBadges {song} />
                </span>
                <span class='flex min-w-0 items-center gap-1.5 text-[12.5px] leading-5 text-neutral-600'>
                  {#if song.download}<span class='flex-none'><DownloadMark {song} variant='inline' /></span>{/if}
                  <span class='truncate' lang={song.lang}>{artistLine(song)}</span>
                </span>
              </button>
              <button
                class='more relative z-1 grid size-8 place-items-center rounded-lg text-neutral-600'
                aria-label='更多操作：{song.title}'
                aria-haspopup='menu'
                onclick={e => ui.openMenuFrom(song, e.currentTarget, { onplay: () => playLiked(i) })}
              >
                <Ellipsis size={17} aria-hidden='true' />
              </button>
            </div>
          </div>
        {/each}
      </div>
      {/if}
    </div>

    <!-- 每日推荐：点方块打开每日推荐页，点右下角的圆钮直接播放 -->
    <div class='relative'>
    <button class='daily group flex size-full flex-col rounded-2xl bg-white p-5 text-left shadow-ambient' onclick={() => nav.openDaily()} aria-label='每日推荐，{daily.dateLabel} {daily.weekday}，{daily.songs.length} 首'>
      <span class='flex items-start justify-between'>
        <span>
          <span class='block text-[56px] leading-[52px] font-600 tracking-[-0.03em] text-primary-900 tnum'>{dailyDay[1]}</span>
          <span class='mt-2 block text-[13px] text-neutral-600'>{dailyDay[0]}月 · {daily.weekday}</span>
        </span>
        <span class='flex pt-1'>
          {#each daily.songs.slice(0, 3) as s, i (s.id)}
            <Cover cover={s.cover} class={['size-11 rounded-lg ring-2 ring-white', i > 0 && '-ml-4']} />
          {/each}
        </span>
      </span>
      <span class='mt-auto flex items-end justify-between'>
        <span>
          <span class='block text-[15px] font-600 text-neutral-900'>每日推荐</span>
          <span class='block text-[13px] text-neutral-600 tnum'>{daily.songs.length} 首</span>
        </span>
      </span>
    </button>
    <button class='play-dot absolute bottom-5 right-5 grid size-11 place-items-center rounded-full bg-primary-900 text-white' aria-label='播放每日推荐' onclick={playDaily}>
      <Play size={18} fill='currentColor' class='ml-0.5' aria-hidden='true' />
    </button>
    </div>
  </div>
</section>

<!-- 歌单 -->
<section class='mt-12' aria-labelledby='a-pl'>
  <div class='mb-4 flex items-center gap-4'>
    {@render heading('a-pl', '歌单')}
    <div class='flex rounded-full bg-white p-1 shadow-ambient' role='radiogroup' aria-label='筛选歌单'>
      {#each playlistFilters as f (f.key)}
        <button
          role='radio'
          aria-checked={filter === f.key}
          class={['h-8 rounded-full px-4 text-[13px] font-500 transition-colors duration-150', filter === f.key ? 'bg-primary-200 text-primary-950' : 'seg text-neutral-600']}
          onclick={() => (filter = f.key)}
        >{f.label}</button>
      {/each}
    </div>
    <button class='pill-ghost ml-auto inline-flex h-9 items-center gap-1.5 rounded-full pl-3 pr-4 text-[14px] font-500 text-neutral-700' onclick={() => nav.openEdit('new')}>
      <Plus size={16} aria-hidden='true' />新建歌单
    </button>
  </div>

  <div class='grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-x-5 gap-y-6'>
    {#each shown as pl (pl.id)}
      <button class='tile min-w-0 text-left' onclick={() => nav.openPlaylist(pl.id)}>
        <span class='relative block'>
          <Cover cover={pl.cover} alt='' class='w-full rounded-xl shadow-ambient' />
        </span>
        <span class='mt-2.5 block truncate text-[14px] font-500 text-neutral-900' lang={langOf(pl.name)}>{pl.name}</span>
        <span class='mt-0.5 flex min-w-0 items-center gap-1 text-[12.5px] text-neutral-600'>
          <span class='flex-none tnum'>{formatCount(pl.count)} 首</span>
          {#if pl.isPrivate}<Lock size={12} class='flex-none' aria-label='私密' />{/if}
          {#if pl.kind === 'collected'}<span class='truncate' lang={langOf(pl.creator)}>· {pl.creator}</span>{/if}
        </span>
      </button>
    {/each}
  </div>
</section>

<!-- 专辑 -->
<section class='mt-12' aria-labelledby='a-al'>
  <div class='mb-4 flex items-center gap-3'>
    {@render heading('a-al', '专辑', `${albums.length} 张`)}
  </div>
  <div class='shelf -mx-2 flex gap-5 overflow-x-auto px-2 pb-3'>
    {#each albums as al (al.id)}
      <button class='tile w-[168px] flex-none text-left' onclick={() => nav.openAlbum(al.id)}>
        <Cover cover={al.cover} class='w-full rounded-xl shadow-ambient' />
        <span class='mt-2.5 block truncate text-[14px] font-500 text-neutral-900' lang={langOf(al.name)}>{al.name}</span>
        <span class='mt-0.5 block truncate text-[12.5px] text-neutral-600' lang={langOf(al.artist)}>{al.artist}</span>
      </button>
    {/each}
  </div>
</section>

<!-- 歌手 -->
<section class='mt-10 pb-12' aria-labelledby='a-ar'>
  <div class='mb-4 flex items-center gap-3'>
    {@render heading('a-ar', '歌手', `${artists.length} 位`)}
  </div>
  <div class='shelf -mx-2 flex gap-6 overflow-x-auto px-2 pb-3'>
    {#each artists as ar (ar.id)}
      <button class='tile w-[120px] flex-none text-center' onclick={() => nav.openArtist(ar.id)}>
        <Cover cover={ar.avatar} class='mx-auto size-[120px] rounded-full shadow-ambient' />
        <span class='mt-2.5 block truncate text-[14px] font-500 text-neutral-900' lang={langOf(ar.name)}>{ar.name}</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .strip {
    display: grid;
    grid-template-rows: repeat(3, 60px);
    grid-auto-flow: column;
    grid-auto-columns: calc((100% - 24px) / 3.25);
    column-gap: 8px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    /* 露出的半列淡进面板里，读作“还有更多”，不是被截断 */
    mask-image: linear-gradient(90deg, transparent 0, #000 var(--fade-l), #000 calc(100% - var(--fade-r)), transparent 100%);
  }

  .cell {
    scroll-snap-align: start;
  }

  .is-off > :global(.grid) {
    opacity: 0.45;
  }

  .play-target::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 12px;
  }

  .play-target:disabled {
    cursor: not-allowed;
  }

  .shelf {
    scrollbar-width: thin;
  }

  .tile :global(img) {
    transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 240ms ease-out;
  }

  .play-dot {
    transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), background-color 160ms ease-out;
  }

  @media (hover: hover) and (pointer: fine) {
    .cell:not(.is-off):hover {
      background: #f9fafb;
    }

    .more:hover,
    .pill-ghost:not(:disabled):hover {
      background: #e8f8f1;
      color: #1a5b43;
    }

    .pill-filled:hover {
      background: #1a5b43;
    }

    .seg:hover {
      color: #111827;
    }

    .tile:hover :global(img) {
      transform: translateY(-2px);
      box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
    }

    .daily:hover + .play-dot,
    .play-dot:hover {
      transform: scale(1.06);
    }

    .play-dot:hover {
      background: #1a5b43;
    }

    .daily:hover {
      box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
    }
  }
</style>
