<!-- PROTOTYPE（变体 C）：桌面曲库。文字标签 + 右侧快捷入口，一条同步细线；我喜欢的音乐是可排序的密集表，其余是封面网格。 -->
<script lang='ts'>
  import type { SongFilter } from '../collections'
  import { ArrowDownToLine, CalendarHeart, Play, Shuffle } from '@lucide/svelte'
  import { daily, formatCount, likedDownloaded, likedSongs } from '$lib/prototype/data'
  import { libraryTabs, nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { albums, artists, playlists } from '$lib/prototype/data'
  import { applyFilter, downloadedSongs, playableSongs } from '../collections'
  import CoverGrid from '../CoverGrid.svelte'
  import FilterChips from '../FilterChips.svelte'
  import SyncLine from '../SyncLine.svelte'
  import SongTable from './SongTable.svelte'

  let filter = $state<SongFilter>('all')

  const counts = {
    liked: likedSongs.length,
    playlists: playlists.length,
    albums: albums.length,
    artists: artists.length,
  }

  const songs = $derived(applyFilter(likedSongs, filter))
  const source = { kind: 'liked' as const, name: '我喜欢的音乐', id: 'liked' }

  function playAll(shuffle = false) {
    if (shuffle)
      player.mode = 'shuffle'
    const i = shuffle ? Math.floor(Math.random() * songs.length) : songs.findIndex(s => !s.unavailable)
    player.playFrom(songs, Math.max(0, i), source)
  }
</script>

<div class='px-8 pt-4'>
  <div class='flex items-center gap-6 shadow-[inset_0_-1px_0_#f3f4f6]'>
    <div class='flex gap-7' role='tablist' aria-label='曲库分类'>
      {#each libraryTabs as t (t.key)}
        <button
          type='button'
          role='tab'
          aria-selected={nav.tab === t.key}
          class='tab'
          class:on={nav.tab === t.key}
          onclick={() => nav.goLibrary(t.key)}
        >
          {t.label}<span class='tnum count'>{formatCount(counts[t.key])}</span>
        </button>
      {/each}
    </div>
    <div class='ml-auto flex gap-2'>
      <button type='button' class='quick' onclick={() => nav.openPlaylist('daily')}>
        <CalendarHeart size={16} aria-hidden='true' />每日推荐<span class='opacity-60'>·</span>{daily.dateLabel}
      </button>
      <button type='button' class='quick' onclick={() => nav.openPlaylist('downloads')}>
        <ArrowDownToLine size={16} aria-hidden='true' />已下载<span class='tnum'>{formatCount(downloadedSongs.length)}</span>
      </button>
    </div>
  </div>
  <div class='mt-3'>
    <SyncLine />
  </div>
</div>

{#if nav.tab === 'liked'}
  <div class='mt-5 px-8 pb-8' role='tabpanel' aria-label='我喜欢的音乐'>
    <div class='mb-2 flex items-center gap-4'>
      <FilterChips bind:value={filter} counts={{ all: likedSongs.length, downloaded: likedDownloaded, playable: playableSongs.length }} />
      <div class='ml-auto flex items-center gap-2'>
        <button type='button' class='btn-ghost' onclick={() => playAll(true)}>
          <Shuffle size={16} aria-hidden='true' />随机播放
        </button>
        <button type='button' class='btn-primary' onclick={() => playAll()}>
          <Play size={16} fill='currentColor' aria-hidden='true' />播放全部
        </button>
      </div>
    </div>
    <SongTable {songs} {source} />
  </div>
{:else}
  <div class='px-8 pb-10 pt-6' role='tabpanel' aria-label={libraryTabs.find(t => t.key === nav.tab)?.label}>
    <CoverGrid tab={nav.tab} />
  </div>
{/if}

<style>
  .tab {
    position: relative;
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    height: 48px;
    padding-top: 14px;
    font-size: 15px;
    font-weight: 500;
    color: #4b5563;
    white-space: nowrap;
  }

  .tab .count {
    font-size: 13px;
    font-weight: 400;
    color: #6b7280;
  }

  .tab.on {
    color: #111827;
    font-weight: 600;
  }

  .tab.on .count {
    color: #4b5563;
  }

  .tab.on::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    border-radius: 2px;
    background: #37be8c;
  }

  .quick {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border-radius: 8px;
    background: #ffeee2;
    color: #b34719;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }

  .btn-primary,
  .btn-ghost {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 14px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
  }

  .btn-primary {
    background: #206f52;
    color: #fff;
  }

  .btn-ghost {
    color: #374151;
  }

  @media (hover: hover) and (pointer: fine) {
    .tab:not(.on):hover {
      color: #111827;
    }

    .quick:hover {
      background: #ffe1cc;
    }

    .btn-primary:hover {
      background: #1a5b43;
    }

    .btn-ghost:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }
  }
</style>
