<!-- PROTOTYPE（变体 C）：手机歌单页。顶栏的搜索条限定在这份列表里（“在 4,815 首中搜索”），打字就地过滤，命中的字即时点亮。 -->
<script lang='ts'>
  import { ArrowDownToLine, ArrowLeft, Ellipsis, Heart, Play, Search, X } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { formatCount, langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import VirtualList from '$lib/prototype/VirtualList.svelte'
  import { collectionOf } from '../collections'
  import { filterSongs } from '../search'
  import { ui } from '../ui.svelte'
  import SongRowP from './SongRowP.svelte'

  const c = $derived(collectionOf(nav.playlistId))
  const total = $derived(c.songs.length)
  const filtered = $derived(filterSongs(c.songs, nav.query))
  const searching = $derived(nav.query.trim() !== '')

  function back() {
    nav.query = ''
    nav.goLibrary()
  }

  function playAll() {
    const i = filtered.findIndex(s => !s.unavailable)
    if (i >= 0)
      player.playFrom(filtered, i, c.source)
  }
</script>

<header class='band'>
  <button type='button' class='icon' aria-label='返回曲库' onclick={back}><ArrowLeft size={22} aria-hidden='true' /></button>
  <label class='field'>
    <Search size={18} class='shrink-0 text-neutral-500' aria-hidden='true' />
    <input
      type='search'
      enterkeyhint='search'
      class='min-w-0 flex-1 bg-transparent text-[15px] text-neutral-900 outline-none'
      placeholder='在 {formatCount(total)} 首中搜索'
      aria-label='在{c.name}中搜索'
      autocomplete='off'
      spellcheck='false'
      value={nav.query}
      oninput={e => (nav.query = e.currentTarget.value)}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          ui.remember(nav.query)
          e.currentTarget.blur()
        }
      }}
    />
    {#if nav.query}
      <button type='button' class='clear' aria-label='清除搜索词' onclick={() => (nav.query = '')}><X size={18} aria-hidden='true' /></button>
    {/if}
  </label>
</header>

<section class='px-4 pt-4'>
  <div class='flex items-center gap-4'>
    <Cover cover={c.cover} eager class='size-28 shrink-0 {c.round ? 'rounded-full' : 'rounded-2xl'} shadow-ambient' />
    <div class='min-w-0'>
      <h1 class='line-clamp-2 text-xl text-neutral-900 font-600 leading-7' lang={langOf(c.name)}>
        {#if c.kind === 'liked'}<Heart size={18} fill='currentColor' class='mr-1 inline-block align-[-2px] text-accent-600' aria-hidden='true' />{/if}{c.name}
      </h1>
      <p class='mt-1 text-[13px] text-neutral-600 leading-5' lang={langOf(c.meta.join(''))}>{c.meta.slice(0, 2).join(' · ')}</p>
      {#if c.kind !== 'downloads'}
        <p class='tnum mt-0.5 inline-flex items-center gap-1 text-[13px] text-secondary-900 leading-5'>
          <ArrowDownToLine size={14} aria-hidden='true' />已下载 {formatCount(c.downloaded)} 首
        </p>
      {/if}
    </div>
  </div>
  <div class='mt-4 flex gap-2'>
    <button type='button' class='btn primary flex-1' onclick={playAll}><Play size={18} fill='currentColor' aria-hidden='true' />播放全部</button>
    <button type='button' class='btn tonal'><ArrowDownToLine size={18} aria-hidden='true' />{c.downloaded >= total ? '已全部下载' : '下载'}</button>
    <button type='button' class='btn square' aria-label='更多歌单操作'><Ellipsis size={20} aria-hidden='true' /></button>
  </div>
</section>

<div class='h-11 flex items-center px-4 pt-2 text-[13px] text-neutral-600'>
  {#if searching}
    <p aria-live='polite'>找到 <span class='tnum text-neutral-900 font-600'>{formatCount(filtered.length)}</span> 首<span class='tnum text-neutral-500'> / {formatCount(total)}</span></p>
  {:else}
    <p class='tnum'>{formatCount(total)} 首 · 最近加入的在前</p>
  {/if}
</div>

<div class='pb-24'>
  {#if filtered.length === 0}
    <p class='px-4 py-12 text-center text-sm text-neutral-500'>这份列表里没有和“{nav.query.trim()}”匹配的歌曲。</p>
  {:else}
    <VirtualList items={filtered} itemHeight={68} getKey={(s, i) => `${s.id}:${i}`}>
      {#snippet row(s, i)}
        <SongRowP song={s} query={nav.query} onplay={() => player.playFrom(filtered, i, c.source)} />
      {/snippet}
    </VirtualList>
  {/if}
</div>

<style>
  .band {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 10px 12px 10px 4px;
    background: #e8f8f1;
  }

  .icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    color: #1f2937;
  }

  .field {
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 6px 0 16px;
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07);
  }

  .field:focus-within {
    box-shadow: 0 0 0 2px #2b976f;
  }

  .field input::placeholder {
    color: #6b7280;
  }

  .field input::-webkit-search-cancel-button {
    display: none;
  }

  .field input:focus-visible {
    outline: none;
  }

  .clear {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    color: #6b7280;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 44px;
    padding: 0 16px;
    border-radius: 8px;
    font-size: 15px;
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
    width: 44px;
    padding: 0;
    background: #f3f4f6;
    color: #374151;
  }
</style>
