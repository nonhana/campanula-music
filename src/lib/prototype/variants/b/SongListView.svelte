<!--
  PROTOTYPE · 桌面的歌曲列表页，两种头部：
  library —— 曲库里的“我喜欢的音乐”（以及每日推荐、已下载）：一条封面染色的头部，标题、首数、操作按钮，搜索图标展开成列表内搜索；
  playlist —— 歌单页：一行紧凑头部（封面 120、名称、信息、操作），右侧是歌单内搜索。
  下面是密排的虚拟列表（跟随窗口滚动）。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { Song } from '$lib/prototype/data'
  import type { PlaySource } from '$lib/prototype/player.svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { formatCount } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import VirtualList from '$lib/prototype/VirtualList.svelte'
  import { Clock, Download, Ellipsis, Play, Search, Shuffle, X } from '@lucide/svelte'
  import { tick } from 'svelte'
  import CoverWash from './CoverWash.svelte'
  import DeskRow from './DeskRow.svelte'
  import { filterSongs, firstPlayable, ui } from './ui.svelte'

  interface Props {
    variant: 'library' | 'playlist'
    songs: Song[]
    source: PlaySource
    title: string
    cover: string
    /** 首数后面的说明，例如“已下载 1,204 首” */
    meta: Snippet
    /** 歌单页：名称上方的一行（创建者等） */
    byline?: string
    /** 曲库头部下面的一行（同步进度） */
    notice?: Snippet
  }

  const { variant, songs, source, title, cover, meta, byline, notice }: Props = $props()

  const filtered = $derived(filterSongs(songs, nav.query))
  const searching = $derived(nav.query.trim() !== '')
  const fieldShown = $derived(variant === 'playlist' || ui.searchOpen || searching)

  function playAt(i: number) {
    player.playFrom(filtered, i, source)
  }

  function playAll() {
    playAt(firstPlayable(filtered))
  }

  function shuffle() {
    player.mode = 'shuffle'
    const playable = filtered.map((s, i) => (s.unavailable ? -1 : i)).filter(i => i >= 0)
    if (playable.length)
      playAt(playable[Math.floor(Math.random() * playable.length)])
  }

  async function openSearch() {
    ui.searchOpen = true
    await tick()
    document.getElementById('vb-list-search')?.focus()
  }

  function closeSearch() {
    nav.query = ''
    if (variant === 'library')
      ui.searchOpen = false
  }
</script>

{#snippet searchField()}
  <label class='field'>
    <Search size={16} strokeWidth={2} aria-hidden='true' />
    <input
      id='vb-list-search'
      type='search'
      placeholder='在「{title}」中搜索'
      autocomplete='off'
      bind:value={nav.query}
      onkeydown={e => e.key === 'Escape' && closeSearch()}
    />
    {#if searching || variant === 'library'}
      <button type='button' class='field-x' aria-label={searching ? '清除搜索' : '收起搜索'} onclick={closeSearch}>
        <X size={14} strokeWidth={2.25} />
      </button>
    {/if}
  </label>
{/snippet}

{#snippet actions(withShuffle: boolean)}
  <button type='button' class='btn solid' onclick={playAll}>
    <Play size={16} strokeWidth={2.25} fill='currentColor' />播放全部
  </button>
  {#if withShuffle}
    <button type='button' class='btn outline' onclick={shuffle}><Shuffle size={16} strokeWidth={2} />随机播放</button>
  {/if}
  <button type='button' class='btn outline' onclick={() => ui.say('已加入下载队列')}><Download size={16} strokeWidth={2} />下载</button>
{/snippet}

{#if variant === 'library'}
  <header class='lib-head'>
    <CoverWash {cover} veil={0.84} />
    <div class='lib-row'>
      <div class='lib-title'>
        <h1>{title}</h1>
        <p class='meta'>{@render meta()}</p>
      </div>
      <div class='lib-actions'>
        {@render actions(true)}
        {#if fieldShown}
          {@render searchField()}
        {:else}
          <button type='button' class='btn icon' aria-label='在「{title}」中搜索' onclick={openSearch}><Search size={17} strokeWidth={2} /></button>
        {/if}
      </div>
    </div>
  </header>
  {#if notice}
    {@render notice()}
  {/if}
{:else}
  <header class='pl-head'>
    <Cover cover={cover} alt='{title} 封面' class='pl-cover' eager />
    <div class='pl-info'>
      {#if byline}<p class='byline'>{byline}</p>{/if}
      <h1 class='pl-title'>{title}</h1>
      <p class='meta'>{@render meta()}</p>
      <div class='pl-actions'>
        {@render actions(false)}
        <button type='button' class='btn icon' aria-label='更多操作'><Ellipsis size={18} strokeWidth={2} /></button>
      </div>
    </div>
    <div class='pl-search'>{@render searchField()}</div>
  </header>
{/if}

<div class='list'>
  <div class='cols' role='presentation'>
    <span class='c-num'>#</span>
    <span>标题</span>
    <span>专辑</span>
    <span>
      {#if searching}<span class='found'>找到 <b class='tnum'>{formatCount(filtered.length)}</b> 首</span>{/if}
    </span>
    <span class='c-dur'><Clock size={14} strokeWidth={2} aria-label='时长' /></span>
    <span></span>
  </div>
  {#if filtered.length}
    <VirtualList items={filtered} itemHeight={52} getKey={(s, i) => `${i}-${s.id}`} class='rows'>
      {#snippet row(song, i)}
        <DeskRow {song} number={i + 1} onplay={() => playAt(i)} />
      {/snippet}
    </VirtualList>
  {:else}
    <div class='empty'>
      <p>没有找到和“{nav.query}”有关的歌曲</p>
      <button type='button' class='btn outline' onclick={closeSearch}>清除搜索</button>
    </div>
  {/if}
</div>

<style>
  .lib-head {
    position: relative;
    overflow: hidden;
    border-radius: 16px;
  }

  .lib-row {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    padding: 22px 24px 20px;
  }

  .lib-title {
    min-width: 0;
  }

  h1 {
    margin: 0;
    font-size: 28px;
    line-height: 36px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #111827;
  }

  .meta {
    margin: 4px 0 0;
    font-size: 13.5px;
    line-height: 20px;
    color: #374151;
    white-space: nowrap;
  }

  .lib-actions,
  .pl-actions {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
  }

  .btn {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 36px;
    padding: 0 16px;
    border-radius: 9999px;
    font-size: 14px;
    white-space: nowrap;
    transition: background-color 140ms, border-color 140ms;
  }

  .solid {
    padding: 0 18px 0 14px;
    background: #111827;
    color: #fff;
    font-weight: 500;
  }

  .outline {
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #1f2937;
  }

  .icon {
    width: 36px;
    padding: 0;
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #374151;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 260px;
    height: 36px;
    padding: 0 6px 0 12px;
    border: 1px solid #e5e7eb;
    border-radius: 9999px;
    background: #fff;
    color: #6b7280;
    transition: border-color 140ms, box-shadow 140ms;
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
    font-size: 13.5px;
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
    width: 26px;
    height: 26px;
    border-radius: 9999px;
    color: #4b5563;
  }

  .pl-head {
    display: flex;
    align-items: flex-end;
    gap: 24px;
    padding: 8px 0 20px;
  }

  .pl-head :global(.pl-cover) {
    flex: none;
    width: 120px;
    height: 120px;
    border-radius: 16px;
    box-shadow: 0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07);
  }

  .pl-info {
    flex: 1;
    min-width: 0;
  }

  .byline {
    margin: 0 0 2px;
    font-size: 13px;
    line-height: 18px;
    color: #4b5563;
  }

  .pl-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 26px;
    line-height: 34px;
  }

  .pl-actions {
    margin-top: 12px;
  }

  .pl-search {
    flex: none;
    align-self: flex-end;
  }

  .list {
    margin-top: 8px;
  }

  .cols {
    position: sticky;
    top: 56px;
    z-index: 5;
    display: grid;
    grid-template-columns: 36px minmax(0, 1.6fr) minmax(0, 1fr) 112px 44px 36px;
    align-items: center;
    column-gap: 16px;
    height: 36px;
    padding: 0 8px 0 12px;
    border-bottom: 1px solid #f3f4f6;
    background: #fff;
    font-size: 12px;
    color: #6b7280;
  }

  .cols > span:nth-child(2) {
    padding-left: 52px;
  }

  .c-num {
    text-align: center;
  }

  .c-dur {
    display: flex;
    justify-content: flex-end;
  }

  .found {
    color: #206f52;
    white-space: nowrap;
  }

  .found b {
    font-weight: 600;
  }

  .list :global(.rows) {
    margin-top: 4px;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 40px 12px;
  }

  .empty p {
    margin: 0;
    font-size: 15px;
    color: #374151;
  }

  @media (hover: hover) and (pointer: fine) {
    .solid:hover {
      background: #1f2937;
    }

    .outline:hover,
    .icon:hover {
      border-color: #d1d5db;
      background: #f9fafb;
    }

    .field:hover:not(:focus-within) {
      border-color: #d1d5db;
    }

    .field-x:hover {
      background: #f3f4f6;
    }
  }
</style>
