<!--
  PROTOTYPE：桌面已下载页（登录、未登录共用；未登录时外框由 DesktopLoggedOut 提供）。
  头部：四张封面拼成的方块 + 标题 + 用量 + 播放全部 / ••• / 本地搜索；登录时有“正在下载”；下面是虚拟列表。
  ?demo=empty 演示这台设备上还没有下载。
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
  import DesktopSongRow from './DesktopSongRow.svelte'
  import DownloadsMore from './DownloadsMore.svelte'
  import DownloadsTasks from './DownloadsTasks.svelte'
  import InlineMore from './InlineMore.svelte'
  import StateBlock from './StateBlock.svelte'
  import { isNow, matchSong, ui } from './state.svelte'

  const source: PlaySource = { kind: 'downloads', name: '已下载' }

  const all = $derived(nav.demo === 'empty' ? [] : downloadedSongs.filter(s => !ui.removed.has(s.id)))
  const q = $derived(nav.query.trim().toLowerCase())
  const list = $derived(q ? all.filter(s => matchSong(s, q)) : all)
  const mosaic = downloadedSongs.slice(0, 4)
  const showTasks = $derived(!nav.loggedOut && nav.demo !== 'empty' && !q && downloadTasks.length > 0)

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

<header class='flex gap-7 pt-2'>
  <div class='relative size-[200px] flex-none'>
    {#if all.length}
      <div class='grid size-full grid-cols-2 overflow-hidden rounded-2xl shadow-ambient'>
        {#each mosaic as s (s.id)}<Cover cover={s.cover} eager class='size-full' />{/each}
      </div>
    {:else}
      <div class='grid size-full place-items-center rounded-2xl bg-secondary-50'>
        <CircleArrowDown size={56} strokeWidth={1.5} class='text-secondary-800' aria-hidden='true' />
      </div>
    {/if}
    {#if all.length}
      <span class='absolute -bottom-2 -right-2 grid size-11 place-items-center rounded-full bg-secondary-100 text-secondary-800 ring-4 ring-primary-50' aria-hidden='true'>
        <CircleArrowDown size={22} />
      </span>
    {/if}
  </div>

  <div class='flex min-w-0 flex-1 flex-col pt-1'>
    <h1 class='text-[28px] leading-9 font-600 tracking-[-0.01em] text-neutral-900'>已下载</h1>
    <p class='mt-2 flex flex-wrap items-center gap-x-1.5 text-[14px] text-neutral-600 tnum'>
      <span>{formatCount(all.length)} 首</span>
      {#if all.length}<span aria-hidden='true'>·</span><span>已用 {storage.used}</span>{/if}
      <span aria-hidden='true'>·</span><span>下载音质：{storage.quality}</span>
    </p>
    {#if nav.loggedOut}
      <p class='mt-2 flex items-center gap-1.5 text-[14px] text-neutral-600'>
        <Info size={15} class='flex-none text-neutral-500' aria-hidden='true' />
        未登录时只能播放、加入播放队列和删除；登录后可以红心、加入歌单
      </p>
    {:else}
      <p class='mt-2 text-[14px] text-neutral-600'>保存在这台设备上，离线也能听</p>
    {/if}

    <div class='mt-auto flex items-center gap-2 pt-4'>
      <button class='filled inline-flex h-10 items-center gap-2 rounded-full bg-primary-900 pl-4 pr-5 text-[14px] font-500 text-white disabled:(bg-neutral-100 text-neutral-500)' disabled={!all.length} onclick={playAll}>
        <Play size={16} fill='currentColor' aria-hidden='true' />播放全部
      </button>
      <DownloadsMore phone={false} count={all.length} disabled={!all.length} />
      {#if all.length}
        <label class='search ml-auto flex h-10 w-[280px] min-w-0 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-3.5 pr-1.5'>
          <Search size={16} class='flex-none text-neutral-500' aria-hidden='true' />
          <input
            bind:value={nav.query}
            type='search'
            class='min-w-0 flex-1 bg-transparent text-[14px] text-neutral-900 outline-none placeholder:text-neutral-500'
            placeholder='在已下载里搜索'
            aria-label='在已下载里搜索'
          />
          {#if nav.query}
            <button class='ghost grid size-7 flex-none place-items-center rounded-full text-neutral-600' aria-label='清除搜索' onclick={() => (nav.query = '')}>
              <X size={14} aria-hidden='true' />
            </button>
          {/if}
        </label>
      {/if}
    </div>
  </div>
</header>

{#if showTasks}
  <DownloadsTasks phone={false} />
{/if}

<div class={['rounded-2xl bg-white p-2 shadow-ambient', showTasks ? 'mt-8' : 'mt-6']}>
  {#if !all.length}
    <StateBlock
      kind='empty'
      icon={CircleArrowDown}
      title='这台设备上还没有下载的歌'
      body={emptyBody}
      actionLabel={nav.loggedOut ? '登录' : '去曲库'}
      onaction={() => nav.goLibrary()}
    />
  {:else}
    <div class='grid h-9 grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px] items-center gap-4 pl-2 pr-1 text-[12px] text-neutral-500'>
      <span class='text-center'>#</span>
      <span class='pl-[52px] tnum' role={q ? 'status' : undefined}>{q ? `找到 ${formatCount(list.length)} 首` : '标题'}</span>
      <span>专辑</span>
      <span>状态</span>
      <span class='text-right'>时长</span>
      <span></span>
    </div>
    {#if list.length === 0}
      <div class='grid h-48 place-items-center text-center'>
        <div>
          <p class='text-[15px] text-neutral-900'>已下载里没有“{nav.query.trim()}”</p>
          <p class='mt-1 text-[13px] text-neutral-600'>换个歌名、歌手或专辑名试试</p>
          <button class='ghost mt-3 h-9 rounded-full px-4 text-[14px] font-500 text-primary-900' onclick={() => (nav.query = '')}>清除搜索</button>
        </div>
      </div>
    {:else}
      <VirtualList items={list} itemHeight={56} getKey={(s: Song) => s.id}>
        {#snippet row(song: Song, i: number)}
          <DesktopSongRow {song} n={i + 1} now={isNow(list, i, song)} onplay={() => play(i)} context='downloads' />
        {/snippet}
      </VirtualList>
    {/if}
  {/if}
</div>

<style>
  .search:focus-within {
    border-color: #59cfa3;
  }

  .search input::-webkit-search-cancel-button {
    display: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .filled:not(:disabled):hover {
      background: #1a5b43;
    }

    .ghost:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }
  }
</style>
