<!--
  PROTOTYPE：桌面歌单页——沿用现有 Campanula 的两栏：左边曲库里的歌单（封面），右边歌单头部 + 4,815 首虚拟列表。
  歌单内搜索在本地即时出结果（?q= 可预填）；?demo=loading | empty | error 演示列表的三种状态；
  ••• 打开歌单操作（编辑信息、改为公开、删除 / 取消收藏），具体弹层由 PlaylistEditor 负责。
-->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import Cover from '$lib/prototype/Cover.svelte'
  import { formatCount, formatPlays, inLibrary, langOf, playlistById, playlists, songsOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import VirtualList from '$lib/prototype/VirtualList.svelte'
  import { CircleArrowDown, Ellipsis, ListMusic, ListPlus, Lock, Play, Search, SearchX, X } from '@lucide/svelte'
  import DesktopSongRow from './DesktopSongRow.svelte'
  import InlineMore from './InlineMore.svelte'
  import PlaylistActions from './PlaylistActions.svelte'
  import SkeletonRows from './SkeletonRows.svelte'
  import StateBlock from './StateBlock.svelte'
  import { isNow, matchSong, sourceOf } from './state.svelte'

  const pl = $derived(playlistById(nav.playlistId) ?? playlists[0])
  const owned = $derived(inLibrary(pl))
  const songs = $derived(nav.demo === 'empty' ? [] : songsOf(pl.id))
  const q = $derived(nav.query.trim().toLowerCase())
  const list = $derived(q ? songs.filter(s => matchSong(s, q)) : songs)
  /** 头部的首数、已下载数按实际显示的列表算（空歌单演示时都是 0），和下面的行对得上 */
  const downloaded = $derived(songs.filter(s => s.download === 'done').length)

  const kindLabel = $derived(pl.kind === 'liked' ? '我喜欢的音乐' : pl.kind === 'own' ? '自建' : owned ? '收藏' : '网易云歌单')

  let moreBtn = $state<HTMLButtonElement | null>(null)
  let actionsOpen = $state(false)

  function play(i: number) {
    player.playFrom(list, i, sourceOf(pl))
  }

  function playAll() {
    const i = list.findIndex(s => player.playable(s))
    if (i >= 0)
      play(i)
  }

  function shuffle() {
    player.mode = 'shuffle'
    const playable = list.map((s, i) => ({ s, i })).filter(({ s }) => player.playable(s))
    const pick = playable[Math.floor(Math.random() * playable.length)]
    if (pick)
      play(pick.i)
  }
</script>

{#snippet emptyBody()}在任何一首歌的<InlineMore />菜单里选“加入歌单”，就能把它放进来。{/snippet}

<div class='grid grid-cols-[208px_minmax(0,1fr)] items-start gap-8'>
  <nav class='side sticky top-[88px] -ml-2 max-h-[calc(100dvh-64px-80px-40px)] overflow-y-auto px-2 pb-4' aria-label='曲库里的歌单'>
    <ul class='flex flex-col gap-1'>
      {#each playlists as p (p.id)}
        {@const active = p.id === pl.id}
        <li>
          <button
            class={['side-item w-full rounded-2xl p-4 text-left transition-colors duration-150', active && 'bg-primary-100']}
            aria-current={active ? 'page' : undefined}
            onclick={() => nav.openPlaylist(p.id)}
          >
            <Cover cover={p.cover} class='w-full rounded-xl' />
            <span class={['mt-2.5 block truncate text-[14px] font-500', active ? 'text-primary-950' : 'text-neutral-900']} lang={langOf(p.name)}>{p.name}</span>
            <span class={['mt-0.5 block text-[12.5px] tnum', active ? 'text-primary-900' : 'text-neutral-600']}>{formatCount(active ? songs.length : p.count)} 首</span>
          </button>
        </li>
      {/each}
    </ul>
  </nav>

  <div class='min-w-0 pt-2'>
    <header class='flex gap-7'>
      <Cover cover={pl.cover} eager class='size-[200px] flex-none rounded-2xl shadow-ambient' />
      <div class='flex min-w-0 flex-1 flex-col pt-1'>
        <h1 class='truncate text-[28px] leading-9 font-600 tracking-[-0.01em] text-neutral-900' lang={langOf(pl.name)}>{pl.name}</h1>
        <p class='mt-2 flex flex-wrap items-center gap-x-1.5 text-[14px] text-neutral-600'>
          <span lang={langOf(pl.creator)}>{pl.creator}</span>
          <span aria-hidden='true'>·</span><span>{kindLabel}</span>
          {#if pl.isPrivate}<span class='inline-flex items-center gap-1'><Lock size={13} aria-hidden='true' />隐私</span>{/if}
          <span aria-hidden='true'>·</span><span class='tnum'>{formatCount(songs.length)} 首</span>
          {#if pl.playCount}<span aria-hidden='true'>·</span><span class='tnum'>播放 {formatPlays(pl.playCount)}</span>{/if}
          {#if downloaded > 0}
            <span aria-hidden='true'>·</span>
            <span class='inline-flex items-center gap-1 text-secondary-900'>
              <CircleArrowDown size={14} class='text-secondary-800' aria-hidden='true' />
              <span class='tnum'>已下载 {formatCount(downloaded)} 首</span>
            </span>
          {/if}
        </p>
        {#if pl.description}
          <p class='mt-2 max-w-[60ch] truncate text-[14px] text-neutral-600' lang={langOf(pl.description)}>{pl.description}</p>
        {/if}
        {#if pl.tags.length}
          <p class='mt-2.5 flex flex-wrap gap-1.5'>
            {#each pl.tags as t (t)}<span class='rounded-full bg-primary-100 px-2.5 text-[12px] leading-6 text-primary-950'>{t}</span>{/each}
          </p>
        {/if}

        <div class='mt-auto flex items-center gap-2 pt-4'>
          <button class='filled inline-flex h-10 items-center gap-2 rounded-full bg-primary-900 pl-4 pr-5 text-[14px] font-500 text-white disabled:(cursor-not-allowed bg-neutral-200 text-neutral-500)' disabled={songs.length === 0} onclick={playAll}>
            <Play size={16} fill='currentColor' aria-hidden='true' />播放全部
          </button>
          {#if !owned}
            <button class='btn-line inline-flex h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-4 pr-5 text-[14px] font-500 text-neutral-800 disabled:opacity-50' disabled={nav.offline}>
              <ListPlus size={16} aria-hidden='true' />收藏
            </button>
          {/if}
          <button class='tonal inline-flex h-10 items-center gap-2 rounded-full bg-secondary-100 pl-4 pr-5 text-[14px] font-500 text-secondary-900 disabled:(cursor-not-allowed opacity-50)' disabled={nav.offline || songs.length === 0}>
            <CircleArrowDown size={16} aria-hidden='true' />下载
          </button>
          <button
            bind:this={moreBtn}
            class='ghost grid size-10 place-items-center rounded-full text-neutral-700'
            aria-label='更多歌单操作'
            aria-haspopup='menu'
            aria-expanded={actionsOpen}
            onclick={() => (actionsOpen = true)}
          >
            <Ellipsis size={18} aria-hidden='true' />
          </button>
          <label class='search ml-auto flex h-10 w-[280px] min-w-0 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-3.5 pr-1.5'>
            <Search size={16} class='flex-none text-neutral-500' aria-hidden='true' />
            <input
              bind:value={nav.query}
              type='search'
              class='min-w-0 flex-1 bg-transparent text-[14px] text-neutral-900 outline-none placeholder:text-neutral-500'
              placeholder='在歌单里搜索'
              aria-label='在歌单里搜索'
            />
            {#if nav.query}
              <button class='ghost grid size-7 flex-none place-items-center rounded-full text-neutral-600' aria-label='清除搜索' onclick={() => (nav.query = '')}>
                <X size={14} aria-hidden='true' />
              </button>
            {/if}
          </label>
        </div>
      </div>
    </header>

    <div class='mt-6 rounded-2xl bg-white p-2 shadow-ambient'>
      <div class='grid h-9 grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px] items-center gap-4 pl-2 pr-1 text-[12px] text-neutral-500'>
        <span class='text-center'>#</span>
        <span class='pl-[52px]' role='status'>{q ? `找到 ${formatCount(list.length)} 首 / ${formatCount(songs.length)}` : '标题'}</span>
        <span>专辑</span>
        <span>状态</span>
        <span class='text-right'>时长</span>
        <span></span>
      </div>
      {#if nav.demo === 'loading'}
        <SkeletonRows count={10} label='正在加载歌单' />
      {:else if nav.demo === 'error'}
        <StateBlock kind='error' title='这张歌单没能加载' body='网络不太稳定。曲库里已经同步的歌单不受影响。' actionLabel='重试' onaction={() => (nav.demo = '')} />
      {:else if songs.length === 0}
        <StateBlock
          kind='empty'
          icon={ListMusic}
          title='这张歌单还没有歌'
          body={emptyBody}
          actionLabel='去搜歌'
          onaction={() => nav.openSearch()}
        />
      {:else if list.length === 0}
        <StateBlock
          compact
          kind='empty'
          icon={SearchX}
          title='这张歌单里没有“{nav.query.trim()}”'
          body='只搜了这张歌单。要找别的歌，可以去网易云里搜。'
          actionLabel='在网易云里搜“{nav.query.trim()}”'
          onaction={() => nav.submitSearch(nav.query.trim())}
        />
      {:else}
        <VirtualList items={list} itemHeight={56} getKey={(s: Song, i: number) => `${s.id}-${i}`}>
          {#snippet row(song: Song, i: number)}
            <DesktopSongRow {song} n={i + 1} now={isNow(list, i, song)} onplay={() => play(i)} />
          {/snippet}
        </VirtualList>
      {/if}
    </div>
  </div>
</div>

{#if actionsOpen}
  <PlaylistActions {pl} phone={false} anchor={moreBtn} onshuffle={shuffle} onclose={() => (actionsOpen = false)} />
{/if}

<style>
  .side {
    scrollbar-width: none;
  }

  .search:focus-within {
    border-color: #59cfa3;
  }

  .search input::-webkit-search-cancel-button {
    display: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .side-item:not([aria-current]):hover {
      background: #fff;
    }

    .filled:not(:disabled):hover {
      background: #1a5b43;
    }

    .tonal:not(:disabled):hover {
      background: #ffe1cc;
    }

    .ghost:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }
  }
</style>
