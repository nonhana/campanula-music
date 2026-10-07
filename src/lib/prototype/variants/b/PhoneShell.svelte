<!--
  PROTOTYPE · 手机外壳（<768px）：顶部一行（小花 + 曲库文字标签 + 搜索），下面一行安静的小标签
  （每日推荐、已下载、同步进度）；Auxio 式歌曲行；底部迷你播放条；播放页盖在最上层。
-->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import type { LibraryTab } from '$lib/prototype/nav.svelte'
  import type { PlaySource } from '$lib/prototype/player.svelte'
  import type { SpecialView } from './ui.svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { daily, firstSync, formatCount, likedDownloaded, likedSongs, playlists, songsOf } from '$lib/prototype/data'
  import { libraryTabs, nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import VirtualList from '$lib/prototype/VirtualList.svelte'
  import { ArrowDownToLine, CalendarDays, ChevronLeft, Download, Ellipsis, Flower, Play, Search, Shuffle, X } from '@lucide/svelte'
  import { tick } from 'svelte'
  import LibraryGrid from './LibraryGrid.svelte'
  import MiniPlayer from './MiniPlayer.svelte'
  import PhonePlayer from './PhonePlayer.svelte'
  import PhoneRow from './PhoneRow.svelte'
  import { filterSongs, firstPlayable, ui } from './ui.svelte'

  const downloads = likedSongs.filter(s => s.download === 'done')

  let lastBase: 'library' | 'playlist' = nav.screen === 'playlist' ? 'playlist' : 'library'
  const base = $derived.by(() => {
    if (nav.screen === 'library' || nav.screen === 'playlist')
      lastBase = nav.screen
    return lastBase
  })

  const playlist = $derived(playlists.find(p => p.id === nav.playlistId) ?? playlists[0])

  /** 当前这一屏的歌曲列表（网格分类时为 null） */
  const view = $derived.by((): { songs: Song[], source: PlaySource, title: string } | null => {
    if (ui.special === 'daily')
      return { songs: daily.songs, source: { kind: 'daily', name: '每日推荐' }, title: '每日推荐' }
    if (ui.special === 'downloads')
      return { songs: downloads, source: { kind: 'downloads', name: '已下载' }, title: '已下载' }
    if (base === 'playlist')
      return { songs: songsOf(playlist.id), source: { kind: playlist.id === 'liked' ? 'liked' : 'playlist', name: playlist.name, id: playlist.id }, title: playlist.name }
    if (nav.tab === 'liked')
      return { songs: likedSongs, source: { kind: 'liked', name: '我喜欢的音乐', id: 'liked' }, title: '我喜欢的音乐' }
    return null
  })

  const filtered = $derived(view ? filterSongs(view.songs, nav.query) : [])
  const searching = $derived(nav.query.trim() !== '')
  const inLibrary = $derived(!ui.special && base === 'library')

  function playAt(i: number) {
    if (view)
      player.playFrom(filtered, i, view.source)
  }

  function shuffle() {
    player.mode = 'shuffle'
    const playable = filtered.map((s, i) => (s.unavailable ? -1 : i)).filter(i => i >= 0)
    if (playable.length)
      playAt(playable[Math.floor(Math.random() * playable.length)])
  }

  function goTab(tab: LibraryTab) {
    ui.special = null
    nav.query = ''
    ui.searchOpen = false
    nav.goLibrary(tab)
    window.scrollTo(0, 0)
  }

  function goSpecial(v: SpecialView) {
    ui.special = v
    nav.query = ''
    ui.searchOpen = false
    window.scrollTo(0, 0)
  }

  function back() {
    nav.query = ''
    if (ui.special)
      ui.special = null
    else nav.goLibrary()
    window.scrollTo(0, 0)
  }

  async function openSearch() {
    if (!view)
      goTab('liked')
    ui.searchOpen = true
    await tick()
    document.getElementById('vb-phone-search')?.focus()
  }

  function closeSearch() {
    nav.query = ''
    ui.searchOpen = false
  }
</script>

{#snippet rows()}
  {#if searching}
    <p class='found'>找到 <b class='tnum'>{formatCount(filtered.length)}</b> 首</p>
  {/if}
  {#if filtered.length}
    <VirtualList items={filtered} itemHeight={58} getKey={(s, i) => `${i}-${s.id}`}>
      {#snippet row(song, i)}
        <PhoneRow {song} onplay={() => playAt(i)} />
      {/snippet}
    </VirtualList>
  {:else}
    <p class='empty'>没有找到和“{nav.query}”有关的歌曲</p>
  {/if}
{/snippet}

<div class='shell'>
  {#if inLibrary}
    <header class='head'>
      {#if ui.searchOpen}
        <div class='search-row'>
          <label class='field'>
            <Search size={17} strokeWidth={2} aria-hidden='true' />
            <input id='vb-phone-search' type='search' placeholder='在我喜欢的音乐中搜索' autocomplete='off' bind:value={nav.query} />
          </label>
          <button type='button' class='text-btn' onclick={closeSearch}>取消</button>
        </div>
      {:else}
        <div class='tabs-row'>
          <Flower size={24} strokeWidth={2} color='#37BE8C' class='logo' aria-label='Campanula' />
          <div class='tabs' role='tablist' aria-label='曲库'>
            {#each libraryTabs as t (t.key)}
              <button type='button' role='tab' class={['tab', nav.tab === t.key && 'on']} aria-selected={nav.tab === t.key} onclick={() => goTab(t.key)}>
                {t.label}
              </button>
            {/each}
          </div>
          <button type='button' class='icon' aria-label='搜索' onclick={openSearch}><Search size={21} strokeWidth={2} /></button>
        </div>
        <div class='chips'>
          <button type='button' class='chip' onclick={() => goSpecial('daily')}>
            <span><CalendarDays size={14} strokeWidth={2} />每日推荐 · {daily.dateLabel}</span>
          </button>
          <button type='button' class='chip' onclick={() => goSpecial('downloads')}>
            <span><ArrowDownToLine size={14} strokeWidth={2} />已下载</span>
          </button>
          <p class='sync' role='status' aria-label='正在同步曲库，歌单 {firstSync.playlistsDone}/{firstSync.playlistsTotal}，已同步的部分可以先搜'>
            <span class='sync-bar' aria-hidden='true'><span style:width='{(firstSync.tracksDone / firstSync.tracksTotal) * 100}%'></span></span>
            同步中 <span class='tnum'>{firstSync.playlistsDone}/{firstSync.playlistsTotal}</span>
          </p>
        </div>
      {/if}
    </header>

    {#if nav.tab === 'liked'}
      {#if !searching}
        <div class='list-head'>
          <p><span class='tnum'>{formatCount(likedSongs.length)}</span> 首 · <span class='dl'>已下载 <span class='tnum'>{formatCount(likedDownloaded)}</span></span></p>
          <button type='button' class='icon' aria-label='随机播放' onclick={shuffle}><Shuffle size={19} strokeWidth={2} /></button>
          <button type='button' class='mini-solid' onclick={() => playAt(firstPlayable(filtered))}>
            <span><Play size={13} strokeWidth={2.5} fill='currentColor' />播放全部</span>
          </button>
        </div>
      {/if}
      {@render rows()}
    {:else}
      <div class='grid-pad'>
        <LibraryGrid tab={nav.tab} phone />
      </div>
    {/if}
  {:else if view}
    <header class='bar'>
      <button type='button' class='icon' aria-label='返回' onclick={back}><ChevronLeft size={24} strokeWidth={2} /></button>
      <p class='bar-title'>{view.title}</p>
    </header>
    <section class='pl'>
      {#if ui.special}
        <h1 class='special-title'>{view.title}</h1>
        <p class='pl-meta'>
          {#if ui.special === 'daily'}
            {daily.dateLabel} {daily.weekday} · <span class='tnum'>{daily.songs.length}</span> 首
          {:else}
            <span class='tnum'>{formatCount(downloads.length)}</span> 首 · 保存在这台设备上，断网也能播放
          {/if}
        </p>
      {:else}
        <div class='pl-top'>
          <Cover cover={playlist.cover} alt='{playlist.name} 封面' class='pl-cover' eager />
          <div class='pl-info'>
            <h1>{playlist.name}</h1>
            <p class='pl-by'>{playlist.creator} 创建</p>
            <p class='pl-meta'>
              <span class='tnum'>{formatCount(playlist.count)}</span> 首{#if playlist.downloaded} · <span class='dl'>已下载 <span class='tnum'>{formatCount(playlist.downloaded)}</span> 首</span>{/if}
            </p>
          </div>
        </div>
      {/if}
      <div class='pl-actions'>
        <button type='button' class='btn solid' onclick={() => playAt(firstPlayable(filtered))}>
          <Play size={16} strokeWidth={2.25} fill='currentColor' />播放全部
        </button>
        <button type='button' class='btn outline' onclick={shuffle}><Shuffle size={16} strokeWidth={2} />随机</button>
        <button type='button' class='btn outline' onclick={() => ui.say('已加入下载队列')}><Download size={16} strokeWidth={2} />下载</button>
        <button type='button' class='btn outline round' aria-label='更多操作'><Ellipsis size={18} strokeWidth={2} /></button>
      </div>
      <label class='field in-page'>
        <Search size={17} strokeWidth={2} aria-hidden='true' />
        <input id='vb-phone-search' type='search' placeholder='在「{view.title}」中搜索' autocomplete='off' bind:value={nav.query} />
        {#if searching}
          <button type='button' class='field-x' aria-label='清除搜索' onclick={() => (nav.query = '')}><X size={15} strokeWidth={2.25} /></button>
        {/if}
      </label>
    </section>
    {@render rows()}
  {/if}

  {#if nav.screen !== 'player'}
    <MiniPlayer />
  {/if}

  {#if nav.screen === 'player'}
    <PhonePlayer />
  {/if}
</div>

<style>
  .shell {
    min-height: 100dvh;
    padding-bottom: calc(80px + env(safe-area-inset-bottom));
    background: #fff;
  }

  .head {
    position: sticky;
    top: 0;
    z-index: 20;
    background: #fff;
  }

  .tabs-row {
    display: flex;
    align-items: center;
    height: 48px;
    padding: 0 2px 0 16px;
  }

  .tabs-row :global(.logo) {
    flex: none;
    margin-right: 10px;
  }

  .tabs {
    display: flex;
    flex: 1;
    gap: 2px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tab {
    position: relative;
    flex: none;
    height: 48px;
    padding: 0 9px;
    font-size: 15px;
    font-weight: 500;
    color: #6b7280;
    white-space: nowrap;
  }

  .tab.on {
    color: #111827;
  }

  .tab.on::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 7px;
    width: 18px;
    height: 3px;
    margin-left: -9px;
    border-radius: 9999px;
    background: #37be8c;
  }

  .icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 9999px;
    color: #1f2937;
  }

  .chips {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 12px 0 12px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .chip {
    display: flex;
    flex: none;
    align-items: center;
    height: 44px;
  }

  .chip > span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 10px;
    border: 1px solid #e5e7eb;
    border-radius: 9999px;
    font-size: 12.5px;
    color: #1f2937;
    white-space: nowrap;
  }

  .chip :global(svg) {
    color: #4b5563;
  }

  .chip:active > span {
    background: #f9fafb;
  }

  .sync {
    display: flex;
    flex: none;
    align-items: center;
    gap: 6px;
    margin: 0 0 0 auto;
    padding-left: 4px;
    font-size: 12px;
    color: #4b5563;
    white-space: nowrap;
  }

  .sync-bar {
    position: relative;
    width: 24px;
    height: 3px;
    overflow: hidden;
    border-radius: 9999px;
    background: #d1f1e3;
  }

  .sync-bar span {
    position: absolute;
    inset: 0 auto 0 0;
    background: #2b976f;
  }

  .search-row {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 56px;
    padding: 0 4px 0 12px;
  }

  .field {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 8px 0 12px;
    border: 1px solid #e5e7eb;
    border-radius: 9999px;
    color: #6b7280;
  }

  .field:focus-within {
    border-color: #59cfa3;
    box-shadow: 0 0 0 3px rgb(168 230 207 / 0.45);
  }

  .field input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    outline: none;
    background: transparent;
    font: inherit;
    font-size: 15px;
    color: #111827;
  }

  .field input::placeholder {
    color: #6b7280;
  }

  .field input::-webkit-search-cancel-button {
    appearance: none;
  }

  .field-x {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 9999px;
    color: #4b5563;
  }

  .text-btn {
    height: 44px;
    padding: 0 12px;
    font-size: 15px;
    color: #206f52;
  }

  .list-head {
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 8px 0 16px;
  }

  .list-head p {
    flex: 1;
    margin: 0;
    font-size: 13px;
    color: #4b5563;
  }

  .shell :global(.dl) {
    color: #b34719;
  }

  .mini-solid {
    display: flex;
    align-items: center;
    height: 44px;
    padding-left: 2px;
  }

  .mini-solid > span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 32px;
    padding: 0 14px 0 11px;
    border-radius: 9999px;
    background: #111827;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
  }

  .found {
    margin: 4px 16px 6px;
    font-size: 13px;
    color: #206f52;
  }

  .empty {
    margin: 32px 16px;
    font-size: 15px;
    color: #374151;
  }

  .grid-pad {
    padding: 12px 16px 24px;
  }

  .bar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 52px;
    padding: 0 16px 0 4px;
    background: #fff;
  }

  .bar-title {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 500;
    color: #111827;
  }

  .pl {
    padding: 4px 16px 8px;
  }

  .pl-top {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .pl-top :global(.pl-cover) {
    flex: none;
    width: 96px;
    height: 96px;
    border-radius: 12px;
    box-shadow: 0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07);
  }

  .pl-info {
    min-width: 0;
  }

  .pl-info h1,
  .special-title {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    font-size: 21px;
    line-height: 29px;
    font-weight: 600;
    color: #111827;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .special-title {
    font-size: 24px;
    line-height: 32px;
  }

  .pl-by,
  .pl-meta {
    margin: 2px 0 0;
    font-size: 13px;
    line-height: 19px;
    color: #4b5563;
  }

  .pl-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 40px;
    padding: 0 14px;
    border-radius: 9999px;
    font-size: 14px;
    white-space: nowrap;
  }

  .solid {
    flex: 1;
    background: #111827;
    color: #fff;
    font-weight: 500;
  }

  .outline {
    border: 1px solid #e5e7eb;
    color: #1f2937;
  }

  .round {
    width: 44px;
    padding: 0;
  }

  .in-page {
    margin-top: 12px;
  }
</style>
