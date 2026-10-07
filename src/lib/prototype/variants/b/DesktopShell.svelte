<!--
  PROTOTYPE · 桌面外壳（≥768px）：白色顶栏（logo、搜索、头像）+ 常驻展开的左侧导航（曲库四个分类就是曲库标签，
  没有单独的首页，打开就是我喜欢的音乐）+ 内容区（跟随窗口滚动）+ 底部通栏；播放页盖在最上层。
-->
<script lang='ts'>
  import type { LibraryTab } from '$lib/prototype/nav.svelte'
  import type { SpecialView } from './ui.svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { daily, firstSync, formatCount, likedDownloaded, likedSongs, me, playlists, songsOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { ArrowDownToLine, CalendarDays, Disc3, Flower, Heart, ListMusic, MicVocal, RefreshCw, Search } from '@lucide/svelte'
  import { tick } from 'svelte'
  import BottomBar from './BottomBar.svelte'
  import DesktopPlayer from './DesktopPlayer.svelte'
  import LibraryGrid from './LibraryGrid.svelte'
  import SongListView from './SongListView.svelte'
  import { ui } from './ui.svelte'

  const downloads = likedSongs.filter(s => s.download === 'done')
  const syncRatio = firstSync.tracksDone / firstSync.tracksTotal

  /** 播放页下面垫着的界面（关掉播放页时回到这里） */
  let lastBase: 'library' | 'playlist' = nav.screen === 'playlist' ? 'playlist' : 'library'
  const base = $derived.by(() => {
    if (nav.screen === 'library' || nav.screen === 'playlist')
      lastBase = nav.screen
    return lastBase
  })

  const playlist = $derived(playlists.find(p => p.id === nav.playlistId) ?? playlists[0])
  const playlistSongs = $derived(songsOf(playlist.id))

  const libraryItems: { tab: LibraryTab, label: string }[] = [
    { tab: 'liked', label: '我喜欢的音乐' },
    { tab: 'playlists', label: '歌单' },
    { tab: 'albums', label: '专辑' },
    { tab: 'artists', label: '歌手' },
  ]

  function isActive(tab: LibraryTab): boolean {
    if (ui.special)
      return false
    if (base === 'playlist')
      return tab === (playlist.id === 'liked' ? 'liked' : 'playlists')
    return nav.tab === tab
  }

  function goTab(tab: LibraryTab) {
    ui.special = null
    ui.searchOpen = false
    nav.query = ''
    nav.goLibrary(tab)
    window.scrollTo(0, 0)
  }

  function goSpecial(view: SpecialView) {
    ui.special = view
    ui.searchOpen = false
    nav.query = ''
    if (nav.screen !== 'library')
      nav.goLibrary()
    window.scrollTo(0, 0)
  }

  async function openSearch() {
    const onList = ui.special || base === 'playlist' || nav.tab === 'liked'
    if (!onList)
      goTab('liked')
    ui.searchOpen = true
    await tick()
    document.getElementById('vb-list-search')?.focus()
  }
</script>

{#snippet libraryMeta()}
  <span class='tnum'>{formatCount(likedSongs.length)}</span> 首 · <span class='dl'>已下载 <span class='tnum'>{formatCount(likedDownloaded)}</span> 首</span>
{/snippet}

{#snippet playlistMeta()}
  <span class='tnum'>{formatCount(playlist.count)}</span> 首{#if playlist.downloaded} · <span class='dl'>已下载 <span class='tnum'>{formatCount(playlist.downloaded)}</span> 首</span>{/if}
  {#if playlist.description} · {playlist.description}{/if}
{/snippet}

{#snippet dailyMeta()}
  {daily.dateLabel} {daily.weekday} · <span class='tnum'>{daily.songs.length}</span> 首 · 每天早上 6 点更新
{/snippet}

{#snippet downloadsMeta()}
  <span class='tnum'>{formatCount(downloads.length)}</span> 首 · 保存在这台设备上，断网也能播放
{/snippet}

{#snippet syncNotice()}
  <div class='sync' role='status'>
    <RefreshCw size={15} strokeWidth={2.25} class='spin' aria-hidden='true' />
    <p class='sync-main'><b>正在同步曲库</b> · 已同步的部分可以先搜</p>
    <p class='sync-detail'>
      歌单 <span class='tnum'>{firstSync.playlistsDone}/{firstSync.playlistsTotal}</span>
      · 曲目 <span class='tnum'>{formatCount(firstSync.tracksDone)} / {formatCount(firstSync.tracksTotal)}</span>
      · 正在同步「{firstSync.current}」
    </p>
    <span class='sync-bar' aria-hidden='true'><span style:width='{syncRatio * 100}%'></span></span>
  </div>
{/snippet}

<div class='shell'>
  <header class='top'>
    <a class='brand' href='/prototype?variant=B' onclick={(e) => { e.preventDefault(); goTab('liked') }}>
      <Flower size={26} strokeWidth={2} color='#37BE8C' aria-hidden='true' />
      <span>Campanula</span>
    </a>
    <button type='button' class='search' onclick={openSearch}>
      <Search size={16} strokeWidth={2} />
      <span>搜索</span>
    </button>
    <button type='button' class='me' aria-label='{me.nickname}的账号'>
      <Cover cover={me.avatar} class='avatar' />
    </button>
  </header>

  <nav class='rail' aria-label='导航'>
    <p class='group'>曲库</p>
    <ul>
      {#each libraryItems as item (item.tab)}
        <li>
          <button type='button' class={['item', isActive(item.tab) && 'active']} aria-current={isActive(item.tab) ? 'page' : undefined} onclick={() => goTab(item.tab)}>
            {#if item.tab === 'liked'}
              <Heart size={18} strokeWidth={2} fill='currentColor' class='heart' />
            {:else if item.tab === 'playlists'}
              <ListMusic size={18} strokeWidth={2} />
            {:else if item.tab === 'albums'}
              <Disc3 size={18} strokeWidth={2} />
            {:else}
              <MicVocal size={18} strokeWidth={2} />
            {/if}
            <span>{item.label}</span>
          </button>
        </li>
      {/each}
    </ul>
    <p class='group'>发现</p>
    <ul>
      <li>
        <button type='button' class={['item', ui.special === 'daily' && 'active']} aria-current={ui.special === 'daily' ? 'page' : undefined} onclick={() => goSpecial('daily')}>
          <CalendarDays size={18} strokeWidth={2} />
          <span>每日推荐</span>
          <small>{daily.dateLabel}</small>
        </button>
      </li>
    </ul>
    <p class='group'>本机</p>
    <ul>
      <li>
        <button type='button' class={['item', ui.special === 'downloads' && 'active']} aria-current={ui.special === 'downloads' ? 'page' : undefined} onclick={() => goSpecial('downloads')}>
          <ArrowDownToLine size={18} strokeWidth={2} />
          <span>已下载</span>
          <small class='tnum'>{formatCount(downloads.length)}</small>
        </button>
      </li>
    </ul>
  </nav>

  <main class='content'>
    {#if ui.special === 'daily'}
      <SongListView variant='library' songs={daily.songs} source={{ kind: 'daily', name: '每日推荐' }} title='每日推荐' cover={daily.songs[0].cover} meta={dailyMeta} />
    {:else if ui.special === 'downloads'}
      <SongListView variant='library' songs={downloads} source={{ kind: 'downloads', name: '已下载' }} title='已下载' cover={downloads[0].cover} meta={downloadsMeta} />
    {:else if base === 'playlist'}
      {#key playlist.id}
        <SongListView
          variant='playlist'
          songs={playlistSongs}
          source={{ kind: playlist.id === 'liked' ? 'liked' : 'playlist', name: playlist.name, id: playlist.id }}
          title={playlist.name}
          cover={playlist.cover}
          byline={playlist.kind === 'collected' ? `${playlist.creator} 创建 · 已收藏` : `${playlist.creator} 创建 · ${playlist.updatedAt.replaceAll('-', '/')} 更新`}
          meta={playlistMeta}
        />
      {/key}
    {:else if nav.tab === 'liked'}
      <SongListView variant='library' songs={likedSongs} source={{ kind: 'liked', name: '我喜欢的音乐', id: 'liked' }} title='我喜欢的音乐' cover={playlists[0].cover} meta={libraryMeta} notice={syncNotice} />
    {:else}
      <header class='grid-head'>
        <h1>{nav.tab === 'playlists' ? '歌单' : nav.tab === 'albums' ? '专辑' : '歌手'}</h1>
      </header>
      {@render syncNotice()}
      <div class='grid-body'>
        <LibraryGrid tab={nav.tab} />
      </div>
    {/if}
  </main>

  <BottomBar />

  {#if nav.screen === 'player'}
    <DesktopPlayer />
  {/if}
</div>

<style>
  .shell {
    min-height: 100dvh;
    background: #fff;
  }

  .top {
    position: fixed;
    inset: 0 0 auto;
    z-index: 30;
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr) auto;
    align-items: center;
    height: 56px;
    padding-right: 20px;
    border-bottom: 1px solid #f3f4f6;
    background: #fff;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    margin-left: 20px;
    padding-right: 8px;
    border-radius: 10px;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #111827;
    text-decoration: none;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 280px;
    height: 36px;
    margin-left: 32px;
    padding: 0 14px;
    border: 1px solid #e5e7eb;
    border-radius: 9999px;
    font-size: 14px;
    color: #6b7280;
    transition: border-color 140ms, background-color 140ms;
  }

  .me {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 9999px;
  }

  .me :global(.avatar) {
    width: 32px;
    height: 32px;
    border-radius: 9999px;
  }

  .rail {
    position: fixed;
    top: 56px;
    bottom: 80px;
    left: 0;
    z-index: 20;
    width: 232px;
    padding: 12px 12px 24px;
    overflow-y: auto;
    border-right: 1px solid #f3f4f6;
    background: #fff;
  }

  .group {
    margin: 16px 12px 6px;
    font-size: 12px;
    line-height: 16px;
    color: #6b7280;
  }

  .group:first-child {
    margin-top: 8px;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 40px;
    padding: 0 12px;
    border-radius: 10px;
    font-size: 14px;
    color: #374151;
    text-align: left;
    transition: background-color 120ms;
  }

  .item :global(svg) {
    flex: none;
    color: #4b5563;
  }

  .item :global(.heart) {
    color: #ff3040;
  }

  .item span {
    flex: 1;
    min-width: 0;
  }

  .item small {
    font-size: 12px;
    color: #6b7280;
  }

  .item.active {
    background: #e8f8f1;
    color: #1a5b43;
    font-weight: 500;
  }

  .item.active :global(svg:not(.heart)) {
    color: #1a5b43;
  }

  .item.active small {
    color: #206f52;
  }

  .content {
    min-width: 0;
    padding: 68px 32px 128px 264px;
  }

  .content :global(.dl) {
    color: #b34719;
  }

  .sync {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    margin-top: 8px;
    padding: 0 16px;
    border-radius: 10px;
    background: #f5fcf9;
    font-size: 13px;
    color: #374151;
  }

  .sync :global(.spin) {
    flex: none;
    color: #2b976f;
    animation: spin 2.4s linear infinite;
  }

  .sync p {
    margin: 0;
    white-space: nowrap;
  }

  .sync-main b {
    font-weight: 500;
    color: #1a5b43;
  }

  .sync-detail {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: right;
    color: #4b5563;
  }

  .sync-bar {
    position: relative;
    flex: none;
    width: 96px;
    height: 4px;
    overflow: hidden;
    border-radius: 9999px;
    background: #d1f1e3;
  }

  .sync-bar span {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: inherit;
    background: #2b976f;
  }

  .grid-head h1 {
    margin: 12px 0 4px;
    font-size: 28px;
    line-height: 36px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #111827;
  }

  .grid-body {
    margin-top: 28px;
  }

  @media (hover: hover) and (pointer: fine) {
    .item:not(.active):hover {
      background: #f9fafb;
      color: #111827;
    }

    .search:hover {
      border-color: #d1d5db;
      background: #f9fafb;
    }

    .brand:hover {
      background: #f9fafb;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
