<!--
  PROTOTYPE：手机歌单页（Auxio 式）：返回栏、居中的封面头部、操作行、歌单内搜索（?q= 可预填）、歌曲行。
  ••• 打开歌单操作的底部弹层；?demo=loading | empty | error 演示列表的三种状态。
-->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import Cover from '$lib/prototype/Cover.svelte'
  import { formatCount, formatPlays, inLibrary, langOf, playlistById, playlists, songsOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import VirtualList from '$lib/prototype/VirtualList.svelte'
  import { CircleArrowDown, Ellipsis, ListMusic, ListPlus, Lock, Play, Search, SearchX, X } from '@lucide/svelte'
  import InlineMore from './InlineMore.svelte'
  import PhoneSongRow from './PhoneSongRow.svelte'
  import PhoneTopBar from './PhoneTopBar.svelte'
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
  const kindLabel = $derived(pl.kind === 'liked' ? '' : pl.kind === 'own' ? '自建' : owned ? '收藏' : '网易云歌单')

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

<PhoneTopBar title='歌单' />

<header class='px-4 pt-2 text-center'>
  <Cover cover={pl.cover} eager class='mx-auto size-[168px] rounded-2xl shadow-ambient' />
  <h1 class='mt-4 line-clamp-2 text-[22px] leading-7 font-600 text-neutral-900' lang={langOf(pl.name)}>{pl.name}</h1>
  <p class='mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 text-[13px] text-neutral-600'>
    <span lang={langOf(pl.creator)}>{pl.creator}</span>
    {#if kindLabel}<span aria-hidden='true'>·</span><span>{kindLabel}</span>{/if}
    {#if pl.isPrivate}<span class='inline-flex items-center gap-0.5'><Lock size={12} aria-hidden='true' />隐私</span>{/if}
    <span aria-hidden='true'>·</span><span class='tnum'>{formatCount(songs.length)} 首</span>
    {#if pl.playCount}<span aria-hidden='true'>·</span><span class='tnum'>播放 {formatPlays(pl.playCount)}</span>{/if}
    {#if downloaded > 0}
      <span aria-hidden='true'>·</span><span class='tnum text-secondary-900'>已下载 {formatCount(downloaded)} 首</span>
    {/if}
  </p>
  <div class='mt-4 flex items-center justify-center gap-2'>
    <button class='inline-flex h-11 items-center gap-2 rounded-full bg-primary-900 pl-4 pr-5 text-[15px] font-500 text-white active:bg-primary-950 disabled:(bg-neutral-200 text-neutral-500)' disabled={songs.length === 0} onclick={playAll}>
      <Play size={17} fill='currentColor' aria-hidden='true' />播放全部
    </button>
    {#if !owned}
      <button class='inline-flex h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-4 pr-5 text-[15px] font-500 text-neutral-800 active:bg-neutral-50 disabled:opacity-50' disabled={nav.offline}>
        <ListPlus size={17} aria-hidden='true' />收藏
      </button>
    {:else}
      <button class='inline-flex h-11 items-center gap-2 rounded-full bg-secondary-100 pl-4 pr-5 text-[15px] font-500 text-secondary-900 active:bg-secondary-200 disabled:opacity-50' disabled={nav.offline || songs.length === 0}>
        <CircleArrowDown size={17} aria-hidden='true' />下载
      </button>
    {/if}
    <button
      bind:this={moreBtn}
      class='grid size-11 place-items-center rounded-full text-neutral-700 active:bg-primary-100'
      aria-label='更多歌单操作'
      aria-haspopup='menu'
      aria-expanded={actionsOpen}
      onclick={() => (actionsOpen = true)}
    >
      <Ellipsis size={20} aria-hidden='true' />
    </button>
  </div>
</header>

<div class='px-4 pt-4'>
  <label class='search flex h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-4 pr-1'>
    <Search size={17} class='flex-none text-neutral-500' aria-hidden='true' />
    <input
      bind:value={nav.query}
      type='search'
      class='min-w-0 flex-1 bg-transparent text-[15px] text-neutral-900 outline-none placeholder:text-neutral-500'
      placeholder='在歌单里搜索'
      aria-label='在歌单里搜索'
    />
    {#if nav.query}
      <button class='grid size-9 flex-none place-items-center rounded-full text-neutral-600' aria-label='清除搜索' onclick={() => (nav.query = '')}>
        <X size={16} aria-hidden='true' />
      </button>
    {/if}
  </label>
  {#if q && list.length > 0}
    <p class='px-1 pt-2.5 text-[13px] text-neutral-600 tnum' role='status'>找到 {formatCount(list.length)} 首 / {formatCount(songs.length)}</p>
  {/if}
</div>

<div class='pt-2'>
  {#if nav.demo === 'loading'}
    <SkeletonRows phone count={8} label='正在加载歌单' />
  {:else if nav.demo === 'error'}
    <StateBlock kind='error' title='这张歌单没能加载' body='网络不太稳定。曲库里已经同步的歌单不受影响。' actionLabel='重试' onaction={() => (nav.demo = '')} />
  {:else if songs.length === 0}
    <StateBlock kind='empty' icon={ListMusic} title='这张歌单还没有歌' body={emptyBody} actionLabel='去搜歌' onaction={() => nav.openSearch()} />
  {:else if list.length === 0}
    <StateBlock
      compact
      kind='empty'
      icon={SearchX}
      title='这张歌单里没有“{nav.query.trim()}”'
      body='只搜了这张歌单。要找别的歌，可以去网易云里搜。'
      actionLabel='在网易云里搜'
      onaction={() => nav.submitSearch(nav.query.trim())}
    />
  {:else}
    <VirtualList items={list} itemHeight={56} getKey={(s: Song, i: number) => `${s.id}-${i}`}>
      {#snippet row(song: Song, i: number)}
        <PhoneSongRow {song} now={isNow(list, i, song)} onplay={() => play(i)} />
      {/snippet}
    </VirtualList>
  {/if}
</div>

{#if actionsOpen}
  <PlaylistActions {pl} phone anchor={moreBtn} onshuffle={shuffle} onclose={() => (actionsOpen = false)} />
{/if}

<style>
  .search:focus-within {
    border-color: #59cfa3;
  }

  .search input::-webkit-search-cancel-button {
    display: none;
  }
</style>
