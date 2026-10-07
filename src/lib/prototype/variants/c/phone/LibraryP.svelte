<!-- PROTOTYPE（变体 C）：手机曲库。顶栏就是搜索条（薄荷底上的白色胶囊），下面文字标签；再下面快捷入口和同步细线。 -->
<script lang='ts'>
  import { ArrowDownToLine, CalendarHeart, Flower, Play } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { albums, artists, daily, formatCount, likedSongs, me, playlists } from '$lib/prototype/data'
  import { libraryTabs, nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import VirtualList from '$lib/prototype/VirtualList.svelte'
  import { downloadedSongs } from '../collections'
  import CoverGrid from '../CoverGrid.svelte'
  import SyncLine from '../SyncLine.svelte'
  import { ui } from '../ui.svelte'
  import SongRowP from './SongRowP.svelte'

  const counts = {
    liked: likedSongs.length,
    playlists: playlists.length,
    albums: albums.length,
    artists: artists.length,
  }
  const source = { kind: 'liked' as const, name: '我喜欢的音乐', id: 'liked' }
</script>

<header class='band'>
  <div class='pill'>
    <button type='button' class='pill-hit' aria-label='搜索曲库和网易云' onclick={() => ui.requestFocus()}></button>
    <Flower size={22} color='#37BE8C' class='pointer-events-none shrink-0' aria-hidden='true' />
    <span class='pointer-events-none min-w-0 flex-1 truncate text-[15px] text-neutral-500'>搜索曲库和网易云</span>
    <button type='button' class='avatar' aria-label='{me.nickname} 的账号'>
      <Cover cover={me.avatar} class='size-8 rounded-full' />
    </button>
  </div>
  <div class='tabs' role='tablist' aria-label='曲库分类'>
    {#each libraryTabs as t (t.key)}
      <button type='button' role='tab' class='tab' class:on={nav.tab === t.key} aria-selected={nav.tab === t.key} onclick={() => nav.goLibrary(t.key)}>
        {t.label}<span class='tnum count'>{formatCount(counts[t.key])}</span>
      </button>
    {/each}
  </div>
</header>

<div class='flex gap-2 px-4 pt-4'>
  <button type='button' class='quick' onclick={() => nav.openPlaylist('daily')}>
    <CalendarHeart size={16} aria-hidden='true' />每日推荐<span class='opacity-60'>·</span>{daily.dateLabel}
  </button>
  <button type='button' class='quick' onclick={() => nav.openPlaylist('downloads')}>
    <ArrowDownToLine size={16} aria-hidden='true' />已下载<span class='tnum'>{formatCount(downloadedSongs.length)}</span>
  </button>
</div>
<div class='pt-4'>
  <SyncLine phone />
</div>

{#if nav.tab === 'liked'}
  <div role='tabpanel' aria-label='我喜欢的音乐' class='pb-24 pt-2'>
    <button type='button' class='play-all' onclick={() => player.playFrom(likedSongs, 0, source)}>
      <span class='grid size-8 place-items-center rounded-lg bg-primary-950 text-white'><Play size={16} fill='currentColor' aria-hidden='true' /></span>
      <span class='text-[15px] text-neutral-900 font-500'>播放全部</span>
      <span class='tnum text-[13px] text-neutral-500'>{formatCount(likedSongs.length)} 首</span>
    </button>
    <VirtualList items={likedSongs} itemHeight={68} getKey={s => s.id}>
      {#snippet row(s, i)}
        <SongRowP song={s} onplay={() => player.playFrom(likedSongs, i, source)} />
      {/snippet}
    </VirtualList>
  </div>
{:else}
  <div role='tabpanel' aria-label={libraryTabs.find(t => t.key === nav.tab)?.label} class='px-4 pb-28 pt-5'>
    <CoverGrid tab={nav.tab} phone />
  </div>
{/if}

<style>
  .band {
    position: sticky;
    top: 0;
    z-index: 20;
    padding: 10px 12px 0;
    background: #e8f8f1;
  }

  .pill {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 8px 0 16px;
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07);
  }

  .pill-hit {
    position: absolute;
    inset: 0;
    border-radius: 999px;
  }

  .avatar {
    position: relative;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 999px;
  }

  .tabs {
    display: flex;
    gap: 20px;
    padding: 0 6px;
    margin-top: 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tab {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    align-items: baseline;
    gap: 4px;
    height: 44px;
    padding-top: 12px;
    font-size: 15px;
    font-weight: 500;
    color: #4b5563;
    white-space: nowrap;
  }

  .tab .count {
    font-size: 12px;
    font-weight: 400;
    color: #4b5563;
  }

  .tab.on {
    color: #111827;
    font-weight: 600;
  }

  .tab.on::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    border-radius: 3px 3px 0 0;
    background: #37be8c;
  }

  .quick {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 12px;
    border-radius: 8px;
    background: #ffeee2;
    color: #b34719;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }

  .play-all {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 52px;
    padding: 0 16px;
  }
</style>
