<!-- PROTOTYPE（变体 C）：桌面歌单页。紧凑的头部；顶栏的搜索框已经限定到这份列表，打字就地过滤并即时点亮。 -->
<script lang='ts'>
  import type { SongFilter } from '../collections'
  import { ArrowDownToLine, Ellipsis, Heart, Play } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { formatCount, langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { applyFilter, collectionOf } from '../collections'
  import FilterChips from '../FilterChips.svelte'
  import { filterSongs } from '../search'
  import { ui } from '../ui.svelte'
  import SongTable from './SongTable.svelte'

  let filter = $state<SongFilter>('all')

  const c = $derived(collectionOf(nav.playlistId))
  const total = $derived(c.songs.length)
  const filtered = $derived(filterSongs(applyFilter(c.songs, filter), nav.query))
  const counts = $derived({
    all: total,
    downloaded: c.downloaded,
    playable: c.songs.filter(s => !s.unavailable).length,
  })
  const searching = $derived(nav.query.trim() !== '')

  function playAll() {
    const i = filtered.findIndex(s => !s.unavailable)
    if (i >= 0)
      player.playFrom(filtered, i, c.source)
  }
</script>

<div class='px-8 pt-7'>
  <header class='flex items-end gap-6'>
    <Cover cover={c.cover} eager class='size-40 shrink-0 {c.round ? 'rounded-full' : 'rounded-2xl'} shadow-ambient' />
    <div class='min-w-0 flex-1 pb-1'>
      <h1 class='flex items-center gap-2 text-[26px] text-neutral-900 font-600 leading-9 tracking-[-0.01em]' lang={langOf(c.name)}>
        {#if c.kind === 'liked'}<Heart size={22} fill='currentColor' class='shrink-0 text-accent-600' aria-hidden='true' />{/if}
        <span class='truncate'>{c.name}</span>
      </h1>
      <p class='mt-1.5 flex flex-wrap items-center gap-x-2 text-[13px] text-neutral-600 leading-5'>
        {#each c.meta as m, i (i)}
          {#if i > 0}<span class='text-neutral-300' aria-hidden='true'>·</span>{/if}
          <span class='tnum' lang={langOf(m)}>{m}</span>
        {/each}
        {#if c.kind !== 'downloads'}
          <span class='text-neutral-300' aria-hidden='true'>·</span>
          <span class='tnum inline-flex items-center gap-1 text-secondary-900'>
            <ArrowDownToLine size={14} aria-hidden='true' />已下载 {formatCount(c.downloaded)} 首
          </span>
        {/if}
      </p>
      {#if c.description}
        <p class='mt-1 max-w-[60ch] truncate text-[13px] text-neutral-600 leading-5'>{c.description}</p>
      {/if}
      <div class='mt-4 flex items-center gap-2'>
        <button type='button' class='btn primary' onclick={playAll}>
          <Play size={16} fill='currentColor' aria-hidden='true' />播放全部
        </button>
        <button type='button' class='btn tonal'>
          <ArrowDownToLine size={16} aria-hidden='true' />{c.downloaded >= total ? '已全部下载' : '下载'}
        </button>
        <button type='button' class='btn square' aria-label='更多歌单操作'>
          <Ellipsis size={18} aria-hidden='true' />
        </button>
      </div>
    </div>
  </header>

  <div class='mt-7 min-h-9 flex items-center gap-4'>
    {#if searching}
      <p class='count text-sm text-neutral-600' aria-live='polite'>
        找到 <span class='tnum text-neutral-900 font-600'>{formatCount(filtered.length)}</span> 首<span class='tnum text-neutral-500'> / {formatCount(total)}</span>
      </p>
      <button type='button' class='link' onclick={() => (nav.query = '')}>清除搜索</button>
    {:else}
      <FilterChips bind:value={filter} {counts} />
      <button type='button' class='hint ml-auto' onclick={() => ui.requestFocus()}>
        在顶栏的搜索框里打字，就在这 {formatCount(total)} 首里找
        <kbd>/</kbd>
      </button>
    {/if}
  </div>
</div>

<div class='px-8 pb-10 pt-2'>
  <SongTable songs={filtered} query={nav.query} source={c.source} />
</div>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
  }

  .btn.primary {
    background: #206f52;
    color: #fff;
  }

  .btn.tonal {
    background: #ffeee2;
    color: #b34719;
  }

  .btn.square {
    width: 36px;
    padding: 0;
    justify-content: center;
    background: #f3f4f6;
    color: #374151;
  }

  .link {
    font-size: 13px;
    font-weight: 500;
    color: #206f52;
  }

  .hint {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #6b7280;
  }

  kbd {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 5px;
    box-shadow: inset 0 0 0 1px #d1d5db;
    font-family: inherit;
    font-size: 11px;
  }

  @media (hover: hover) and (pointer: fine) {
    .btn.primary:hover {
      background: #1a5b43;
    }

    .btn.tonal:hover {
      background: #ffe1cc;
    }

    .btn.square:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }

    .link:hover,
    .hint:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }
</style>
