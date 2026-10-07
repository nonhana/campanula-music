<!--
  PROTOTYPE：手机曲库。顶部应用栏（logo、搜索、每日推荐日历）+ 文字标签（我喜欢 / 歌单 / 专辑 / 歌手）+ 同步条。
  ?demo=loading | empty | error 演示“我喜欢”标签的加载中、空、出错。
-->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import type { PlaylistFilter } from './state.svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { albums, artists, daily, firstSync, formatCount, langOf, likedSongs } from '$lib/prototype/data'
  import { libraryTabs, nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import VirtualList from '$lib/prototype/VirtualList.svelte'
  import { Calendar, Flower, Heart, Lock, RefreshCw, Search } from '@lucide/svelte'
  import InlineMore from './InlineMore.svelte'
  import PhoneSongRow from './PhoneSongRow.svelte'
  import SkeletonRows from './SkeletonRows.svelte'
  import StateBlock from './StateBlock.svelte'
  import { dailyDay, filterPlaylists, isNow, likedSource, playlistFilters } from './state.svelte'

  const syncPct = (firstSync.tracksDone / firstSync.tracksTotal) * 100
  let filter = $state<PlaylistFilter>('all')
  const shown = $derived(filterPlaylists(filter))
</script>

{#snippet likedEmptyBody()}在任何一首歌的<InlineMore />菜单里点“红心”，它就会出现在这里。{/snippet}

<div class='sticky top-0 z-20 bg-primary-50'>
  <div class='flex h-14 items-center pl-4 pr-1'>
    <Flower size={26} color='#37BE8C' strokeWidth={1.8} aria-hidden='true' />
    <span class='ml-2 text-[18px] font-500 tracking-[-0.01em] text-neutral-900'>Campanula</span>
    <button class='ml-auto grid size-11 place-items-center rounded-full text-neutral-700 active:bg-primary-100' aria-label='搜索' onclick={() => nav.openSearch()}>
      <Search size={22} aria-hidden='true' />
    </button>
    <button
      class='relative grid size-11 place-items-center rounded-full text-neutral-700 active:bg-primary-100'
      aria-label='每日推荐 · {daily.dateLabel} {daily.weekday}'
      onclick={() => nav.openDaily()}
    >
      <Calendar size={24} strokeWidth={1.8} aria-hidden='true' />
      <span class='absolute left-0 right-0 top-[19px] text-center text-[10px] leading-3 font-600 text-neutral-900 tnum' aria-hidden='true'>{dailyDay[1]}</span>
    </button>
  </div>
  <div class='tabs flex overflow-x-auto px-2' role='tablist' aria-label='曲库分类'>
    {#each libraryTabs as tab (tab.key)}
      {@const active = nav.tab === tab.key}
      <button
        role='tab'
        aria-selected={active}
        class={['relative h-11 flex-none px-3 text-[15px] transition-colors duration-150', active ? 'font-600 text-neutral-900' : 'font-500 text-neutral-500']}
        onclick={() => nav.goLibrary(tab.key)}
      >
        {tab.label}
        {#if active}
          <span class='absolute bottom-1 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-primary-700' aria-hidden='true'></span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<!-- 首次同步：一条细条，跟着内容滚走（离线时暂停） -->
<div class='relative' role='status'>
  <div class='flex h-9 items-center gap-2 px-4 text-[12.5px] text-neutral-600'>
    <RefreshCw size={14} class={['flex-none', nav.offline ? 'text-neutral-500' : 'spin text-primary-800']} aria-hidden='true' />
    <span class='min-w-0 flex-1 truncate'>{nav.offline ? '同步已暂停 · 联网后接着同步' : '正在同步曲库 · 已同步的部分可以先搜'}</span>
    <span class='flex-none tnum'>{formatCount(firstSync.tracksDone)} / {formatCount(firstSync.tracksTotal)}</span>
  </div>
  <div class='mx-4 h-[2px] overflow-hidden rounded-full bg-primary-100' aria-hidden='true'>
    <div class='h-full rounded-full bg-primary-700' style:width='{syncPct}%'></div>
  </div>
</div>

{#if nav.tab === 'liked'}
  <div class='pt-1.5'>
    {#if nav.demo === 'loading'}
      <SkeletonRows phone count={10} label='正在加载我喜欢的音乐' />
    {:else if nav.demo === 'empty'}
      <StateBlock
        kind='empty'
        icon={Heart}
        title='还没有红心的歌'
        body={likedEmptyBody}
        actionLabel='去搜一首'
        onaction={() => nav.openSearch()}
      />
    {:else if nav.demo === 'error'}
      <StateBlock
        kind='error'
        title='我喜欢的音乐没能同步'
        body='网络不太稳定。已经同步的歌照常能听、能搜。'
        actionLabel='重试'
        onaction={() => (nav.demo = '')}
      />
    {:else}
      <VirtualList items={likedSongs} itemHeight={56} getKey={(s: Song) => s.id}>
        {#snippet row(song: Song, i: number)}
          <PhoneSongRow {song} now={isNow(likedSongs, i, song)} onplay={() => player.playFrom(likedSongs, i, likedSource)} />
        {/snippet}
      </VirtualList>
    {/if}
  </div>
{:else if nav.tab === 'playlists'}
  <div class='flex gap-2 px-4 pt-4' role='radiogroup' aria-label='筛选歌单'>
    {#each playlistFilters as f (f.key)}
      <button
        role='radio'
        aria-checked={filter === f.key}
        class={['h-9 rounded-full px-4 text-[14px] font-500', filter === f.key ? 'bg-primary-200 text-primary-950' : 'border border-neutral-200 bg-white text-neutral-600']}
        onclick={() => (filter = f.key)}
      >{f.label}</button>
    {/each}
  </div>
  <div class='grid grid-cols-2 gap-x-3 gap-y-5 px-4 pt-4'>
    {#each shown as pl (pl.id)}
      <button class='min-w-0 text-left' onclick={() => nav.openPlaylist(pl.id)}>
        <Cover cover={pl.cover} class='w-full rounded-xl shadow-ambient' />
        <span class='mt-2 block truncate text-[15px] font-500 text-neutral-900' lang={langOf(pl.name)}>{pl.name}</span>
        <span class='mt-0.5 flex min-w-0 items-center gap-1 text-[13px] text-neutral-600'>
          <span class='flex-none tnum'>{formatCount(pl.count)} 首</span>
          {#if pl.isPrivate}<Lock size={12} class='flex-none' aria-label='私密' />{/if}
          {#if pl.kind === 'collected'}<span class='truncate' lang={langOf(pl.creator)}>· {pl.creator}</span>{/if}
        </span>
      </button>
    {/each}
  </div>
{:else if nav.tab === 'albums'}
  <div class='grid grid-cols-2 gap-x-3 gap-y-5 px-4 pt-4'>
    {#each albums as al (al.id)}
      <button class='min-w-0 text-left' onclick={() => nav.openAlbum(al.id)}>
        <Cover cover={al.cover} class='w-full rounded-xl shadow-ambient' />
        <span class='mt-2 block truncate text-[15px] font-500 text-neutral-900' lang={langOf(al.name)}>{al.name}</span>
        <span class='mt-0.5 block truncate text-[13px] text-neutral-600' lang={langOf(al.artist)}>{al.artist} · {al.year}</span>
      </button>
    {/each}
  </div>
{:else}
  <div class='grid grid-cols-3 gap-x-3 gap-y-5 px-4 pt-5'>
    {#each artists as ar (ar.id)}
      <button class='min-w-0 text-center' onclick={() => nav.openArtist(ar.id)}>
        <Cover cover={ar.avatar} class='mx-auto w-full rounded-full shadow-ambient' />
        <span class='mt-2 block truncate text-[14px] font-500 text-neutral-900' lang={langOf(ar.name)}>{ar.name}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .tabs {
    scrollbar-width: none;
  }

  .tabs::-webkit-scrollbar {
    display: none;
  }
</style>
