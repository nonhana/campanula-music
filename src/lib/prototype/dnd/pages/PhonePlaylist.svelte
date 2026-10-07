<!--
  PROTOTYPE：手机歌单页（照视觉原型的 PhonePlaylist）：返回栏、居中的封面头部、操作行、歌单内搜索、4,815 首的列表。
  选择模式时返回栏换成选择栏；方案 C 在列表上方多一个“多选”按钮（编辑模式的入口）。
-->
<script lang='ts'>
  import type { Song } from '../data'
  import { ArrowLeft, Camera, CircleArrowDown, Ellipsis, ListChecks, Lock, Play, Search, X } from '@lucide/svelte'
  import Cover from '../Cover.svelte'
  import { formatCount, formatPlays, langOf } from '../data'
  import PhoneSelectBar from '../selection/PhoneSelectBar.svelte'
  import SongList from '../SongList.svelte'
  import { downloads, isSortable, library, playSong, selection, tracksOf, view } from '../store.svelte'

  interface Props {
    onback: () => void
    onplaylistmenu: (e: MouseEvent) => void
    oncover?: () => void
    coverBusy?: number | null
  }

  const { onback, onplaylistmenu, oncover, coverBusy = null }: Props = $props()

  const pl = $derived(library.byId(view.pl) ?? library.own[0])
  const tracks = $derived(tracksOf(pl.id))
  let query = $state('')
  const q = $derived(query.trim().toLowerCase())
  const list = $derived(q ? tracks.local.filter(s => match(s, q)) : tracks.local)
  const sortable = $derived(isSortable(pl) && !q)
  const downloaded = $derived(tracks.local.reduce((n, s) => n + (downloads.stateOf(s) === 'done' ? 1 : 0), 0))
  const kindLabel = $derived(pl.kind === 'liked' ? '' : pl.kind === 'own' ? '自建' : '收藏')

  function match(s: Song, needle: string) {
    return s.title.toLowerCase().includes(needle) || s.artists.some(a => a.toLowerCase().includes(needle)) || s.album.toLowerCase().includes(needle)
  }

  function playAll() {
    const s = list.find(x => !x.unavailable)
    if (s)
      playSong(s)
  }
</script>

{#if selection.mode}
  <PhoneSelectBar {list} />
{:else}
  <div class='sticky top-0 z-20 flex h-14 items-center gap-1 bg-primary-50 px-1'>
    <button class='grid size-11 flex-none place-items-center rounded-full text-neutral-800 active:bg-primary-100' aria-label='返回曲库' onclick={onback}>
      <ArrowLeft size={22} aria-hidden='true' />
    </button>
    <span class='min-w-0 flex-1 truncate text-[16px] font-500 text-neutral-900'>歌单</span>
  </div>
{/if}

<header class='px-4 pt-2 text-center'>
  {#if oncover && pl.kind === 'own'}
    <button class='cover-btn relative mx-auto block size-[168px] rounded-2xl' aria-label='更换封面' onclick={oncover}>
      <Cover cover={library.coverOf(pl)} eager class='size-[168px] rounded-2xl shadow-ambient' />
      {#if coverBusy != null}
        <span class='absolute inset-0 grid place-items-center rounded-2xl bg-white/55'>
          <span class='ring' style:--p={coverBusy} aria-hidden='true'></span>
        </span>
      {:else}
        <span class='absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-white text-neutral-800 shadow-float' aria-hidden='true'><Camera size={18} /></span>
      {/if}
    </button>
  {:else}
    <Cover cover={library.coverOf(pl)} eager class='mx-auto size-[168px] rounded-2xl shadow-ambient' />
  {/if}
  <h1 class='mt-4 line-clamp-2 text-[22px] leading-7 font-600 text-neutral-900' lang={langOf(pl.name)}>{pl.name}</h1>
  <p class='mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 text-[13px] text-neutral-600'>
    <span lang={langOf(pl.creator)}>{pl.creator}</span>
    {#if kindLabel}<span aria-hidden='true'>·</span><span>{kindLabel}</span>{/if}
    {#if pl.isPrivate}<span class='inline-flex items-center gap-0.5'><Lock size={12} aria-hidden='true' />隐私</span>{/if}
    <span aria-hidden='true'>·</span><span class='tnum'>{formatCount(tracks.local.length)} 首</span>
    {#if pl.playCount}<span aria-hidden='true'>·</span><span class='tnum'>播放 {formatPlays(pl.playCount)}</span>{/if}
    {#if downloaded > 0}
      <span aria-hidden='true'>·</span><span class='tnum text-secondary-900'>已下载 {formatCount(downloaded)} 首</span>
    {/if}
  </p>
  <div class='mt-4 flex items-center justify-center gap-2'>
    <button class='inline-flex h-11 items-center gap-2 rounded-full bg-primary-900 pl-4 pr-5 text-[15px] font-500 text-white active:bg-primary-950' onclick={playAll}>
      <Play size={17} fill='currentColor' aria-hidden='true' />播放全部
    </button>
    <button class='inline-flex h-11 items-center gap-2 rounded-full bg-secondary-100 pl-4 pr-5 text-[15px] font-500 text-secondary-900 active:bg-secondary-200'>
      <CircleArrowDown size={17} aria-hidden='true' />下载
    </button>
    <button class='grid size-11 place-items-center rounded-full text-neutral-700 active:bg-primary-100' aria-label='更多歌单操作' aria-haspopup='menu' onclick={onplaylistmenu}>
      <Ellipsis size={20} aria-hidden='true' />
    </button>
  </div>
</header>

<div class='px-4 pt-4'>
  <label class='search flex h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-4 pr-1'>
    <Search size={17} class='flex-none text-neutral-500' aria-hidden='true' />
    <input
      bind:value={query}
      type='search'
      class='min-w-0 flex-1 bg-transparent text-[15px] text-neutral-900 outline-none placeholder:text-neutral-500'
      placeholder='在歌单里搜索'
      aria-label='在歌单里搜索'
    />
    {#if query}
      <button class='grid size-9 flex-none place-items-center rounded-full text-neutral-600' aria-label='清除搜索' onclick={() => (query = '')}>
        <X size={16} aria-hidden='true' />
      </button>
    {/if}
  </label>
</div>

{#if q || pl.kind !== 'own' || (view.dragVariant === 'C' && !selection.mode && list.length)}
  <div class='flex min-h-11 items-center gap-2 px-4 pt-2'>
    <p class='min-w-0 flex-1 text-[13px] text-neutral-600 tnum' role='status'>
      {#if q}
        找到 {formatCount(list.length)} 首 / {formatCount(tracks.local.length)}{#if isSortable(pl)}<span class='text-neutral-500'> · 搜索时不能调整顺序</span>{/if}
      {:else if pl.kind === 'liked'}
        我喜欢的音乐按红心时间排列
      {:else if pl.kind === 'collected'}
        收藏的歌单不能编辑
      {/if}
    </p>
    {#if view.dragVariant === 'C' && !selection.mode && list.length}
      <button class='inline-flex h-9 flex-none items-center gap-1.5 rounded-full border border-neutral-200 bg-white pl-3 pr-3.5 text-[14px] font-500 text-neutral-800 active:bg-neutral-50' onclick={() => selection.enter()}>
        <ListChecks size={16} aria-hidden='true' />{isSortable(pl) && !q ? '多选 · 排序' : '多选'}
      </button>
    {/if}
  </div>
{/if}

<div class='pt-2'>
  {#if list.length}
    <SongList {list} plId={pl.id} {sortable} phone />
  {:else}
    <p class='px-6 py-16 text-center text-[14px] text-neutral-600'>{q ? `这张歌单里没有“${query.trim()}”` : '这张歌单还没有歌'}</p>
  {/if}
</div>

<style>
  .search:focus-within {
    border-color: #59cfa3;
    box-shadow: 0 0 0 3px #e8f8f1;
  }

  .search input::-webkit-search-cancel-button {
    display: none;
  }

  @property --p {
    syntax: '<number>';
    inherits: false;
    initial-value: 0;
  }

  .ring {
    width: 56px;
    height: 56px;
    border-radius: 9999px;
    background: conic-gradient(#206f52 calc(var(--p) * 1turn), #d1f1e3 0);
    mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
    transition: --p 120ms linear;
  }
</style>
