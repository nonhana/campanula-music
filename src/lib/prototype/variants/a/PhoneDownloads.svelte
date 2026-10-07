<!--
  PROTOTYPE：手机已下载页（登录、未登录共用；未登录时顶栏由 PhoneLoggedOut 提供）。
  头部：拼贴封面 + 标题 + 用量；播放全部、•••（清空全部下载）、本地搜索；登录时有“正在下载”；下面是歌曲行。
-->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import type { PlaySource } from '$lib/prototype/player.svelte'
  import { downloadedSongs, downloadTasks, storage } from '$lib/prototype/catalog'
  import Cover from '$lib/prototype/Cover.svelte'
  import { formatCount } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import VirtualList from '$lib/prototype/VirtualList.svelte'
  import { CircleArrowDown, Info, Play, Search, X } from '@lucide/svelte'
  import DownloadsMore from './DownloadsMore.svelte'
  import DownloadsTasks from './DownloadsTasks.svelte'
  import InlineMore from './InlineMore.svelte'
  import PhoneSongRow from './PhoneSongRow.svelte'
  import PhoneTopBar from './PhoneTopBar.svelte'
  import StateBlock from './StateBlock.svelte'
  import { isNow, matchSong, ui } from './state.svelte'

  const source: PlaySource = { kind: 'downloads', name: '已下载' }

  const all = $derived(nav.demo === 'empty' ? [] : downloadedSongs.filter(s => !ui.removed.has(s.id)))
  const q = $derived(nav.query.trim().toLowerCase())
  const list = $derived(q ? all.filter(s => matchSong(s, q)) : all)
  const mosaic = downloadedSongs.slice(0, 4)
  const showTasks = $derived(!nav.loggedOut && nav.demo !== 'empty' && downloadTasks.length > 0)

  function play(i: number) {
    player.playFrom(list, i, source)
  }

  function playAll() {
    const i = list.findIndex(s => player.playable(s))
    if (i >= 0)
      play(i)
  }
</script>

{#snippet emptyBody()}{nav.loggedOut ? '登录后，' : ''}在歌单页点“下载”，或者在歌曲的<InlineMore />菜单里点“下载”。下载的歌离线也能听。{/snippet}

{#if !nav.loggedOut}
  <PhoneTopBar title='已下载' />
{/if}

<header class='px-4 pt-2'>
  <div class='flex items-center gap-4'>
    {#if all.length}
      <div class='grid size-[88px] flex-none grid-cols-2 overflow-hidden rounded-2xl shadow-ambient'>
        {#each mosaic as s (s.id)}<Cover cover={s.cover} eager class='size-full' />{/each}
      </div>
    {:else}
      <div class='grid size-[88px] flex-none place-items-center rounded-2xl bg-secondary-50'>
        <CircleArrowDown size={34} strokeWidth={1.6} class='text-secondary-800' aria-hidden='true' />
      </div>
    {/if}
    <div class='min-w-0'>
      <h1 class='text-[24px] leading-8 font-600 tracking-[-0.01em] text-neutral-900'>已下载</h1>
      <p class='mt-1 text-[13px] leading-5 text-neutral-600 tnum'>
        <span>{formatCount(all.length)} 首</span>
        {#if all.length}<span aria-hidden='true'>·</span> <span>已用 {storage.used}</span>{/if}
      </p>
      <p class='text-[13px] leading-5 text-neutral-600'>下载音质：{storage.quality}</p>
    </div>
  </div>

  {#if nav.loggedOut}
    <p class='mt-4 flex gap-2 rounded-xl bg-white px-3.5 py-2.5 text-[13px] leading-5 text-neutral-600'>
      <Info size={15} class='mt-0.5 flex-none text-neutral-500' aria-hidden='true' />
      未登录时只能播放、加入播放队列和删除；登录后可以红心、加入歌单
    </p>
  {/if}

  <div class='mt-4 flex items-center gap-2'>
    <button
      class='inline-flex h-11 items-center gap-2 rounded-full bg-primary-900 pl-4 pr-5 text-[15px] font-500 text-white active:bg-primary-950 disabled:(bg-neutral-100 text-neutral-500)'
      disabled={!all.length}
      onclick={playAll}
    >
      <Play size={17} fill='currentColor' aria-hidden='true' />播放全部
    </button>
    <DownloadsMore phone count={all.length} disabled={!all.length} />
  </div>

  {#if all.length}
    <label class='search mt-4 flex h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-4 pr-1'>
      <Search size={17} class='flex-none text-neutral-500' aria-hidden='true' />
      <input
        bind:value={nav.query}
        type='search'
        class='min-w-0 flex-1 bg-transparent text-[15px] text-neutral-900 outline-none placeholder:text-neutral-500'
        placeholder='在已下载里搜索'
        aria-label='在已下载里搜索'
      />
      {#if nav.query}
        <button class='grid size-9 flex-none place-items-center rounded-full text-neutral-600' aria-label='清除搜索' onclick={() => (nav.query = '')}>
          <X size={16} aria-hidden='true' />
        </button>
      {/if}
    </label>
    {#if q}
      <p class='px-1 pt-2.5 text-[13px] text-neutral-600 tnum' role='status'>找到 {formatCount(list.length)} 首</p>
    {/if}
  {/if}
</header>

{#if showTasks && !q}
  <DownloadsTasks phone />
  <h2 class='px-4 pb-1 pt-5 text-[17px] leading-6 font-600 text-neutral-900'>已下载的歌</h2>
{/if}

<div class='pt-2'>
  {#if !all.length}
    <StateBlock
      kind='empty'
      icon={CircleArrowDown}
      title='这台设备上还没有下载的歌'
      body={emptyBody}
      actionLabel={nav.loggedOut ? '登录' : '去曲库'}
      onaction={() => nav.goLibrary()}
    />
  {:else if list.length === 0}
    <div class='px-6 py-12 text-center'>
      <p class='text-[15px] text-neutral-900'>已下载里没有“{nav.query.trim()}”</p>
      <p class='mt-1 text-[13px] text-neutral-600'>换个歌名、歌手或专辑名试试</p>
    </div>
  {:else}
    <VirtualList items={list} itemHeight={56} getKey={(s: Song) => s.id}>
      {#snippet row(song: Song, i: number)}
        <PhoneSongRow {song} now={isNow(list, i, song)} onplay={() => play(i)} context='downloads' />
      {/snippet}
    </VirtualList>
  {/if}
</div>

<style>
  .search:focus-within {
    border-color: #59cfa3;
  }

  .search input::-webkit-search-cancel-button {
    display: none;
  }
</style>
