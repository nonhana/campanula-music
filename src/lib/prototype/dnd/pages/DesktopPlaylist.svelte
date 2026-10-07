<!--
  PROTOTYPE：桌面歌单页（照视觉原型的 DesktopPlaylist）：左 208px 曲库里的歌单，右边 200px 封面头部 + 操作行 + 歌单内搜索 + 4,815 首。
  列表的表头吸在顶栏下面；选中了歌（Ctrl/⌘ 点选、Shift 连选、方案 C 的编辑模式）时，表头换成批量操作条。
-->
<script lang='ts'>
  import type { Song } from '../data'
  import { Camera, CircleArrowDown, Ellipsis, HeartOff, ListChecks, ListMinus, ListPlus, Lock, Play, Search, X } from '@lucide/svelte'
  import Cover from '../Cover.svelte'
  import { formatCount, formatPlays, langOf } from '../data'
  import SongList from '../SongList.svelte'
  import { downloads, downloadSongs, isSortable, library, playSong, requestRemove, selection, tracksOf, ui, view } from '../store.svelte'

  interface Props {
    onopen: (id: string) => void
    onplaylistmenu: (e: MouseEvent) => void
    oncover?: () => void
    coverBusy?: number | null
  }

  const { onopen, onplaylistmenu, oncover, coverBusy = null }: Props = $props()

  const pl = $derived(library.byId(view.pl) ?? library.own[0])
  const tracks = $derived(tracksOf(pl.id))
  let query = $state('')
  const q = $derived(query.trim().toLowerCase())
  const list = $derived(q ? tracks.local.filter(s => match(s, q)) : tracks.local)
  const sortable = $derived(isSortable(pl) && !q)
  const downloaded = $derived(tracks.local.reduce((n, s) => n + (downloads.stateOf(s) === 'done' ? 1 : 0), 0))
  const kindLabel = $derived(pl.kind === 'liked' ? '我喜欢的音乐' : pl.kind === 'own' ? '自建' : '收藏')
  const picked = $derived(selection.size ? list.filter(s => selection.has(s.id)) : [])
  const allOn = $derived(selection.size >= list.length && list.length > 0 && list.every(s => selection.has(s.id)))
  const toolbar = $derived(selection.size > 0 || selection.mode)
  const gripLead = $derived(view.dragVariant === 'B' && sortable)

  function match(s: Song, needle: string) {
    return s.title.toLowerCase().includes(needle) || s.artists.some(a => a.toLowerCase().includes(needle)) || s.album.toLowerCase().includes(needle)
  }

  function playAll() {
    const s = list.find(x => !x.unavailable)
    if (s)
      playSong(s)
  }

  function openAdd(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    ui.add = { songs: picked, x: r.right, y: r.bottom + 6, sheet: false }
  }
</script>

<div class='grid grid-cols-[208px_minmax(0,1fr)] items-start gap-8'>
  <nav class='side sticky top-[88px] -ml-2 max-h-[calc(100dvh-64px-80px-40px)] overflow-y-auto px-2 pb-4' aria-label='曲库里的歌单'>
    <ul class='flex flex-col gap-1'>
      {#each library.ordered as p (p.id)}
        {@const active = p.id === pl.id}
        <li>
          <button
            class={['side-item w-full rounded-2xl p-4 text-left transition-colors duration-150', active && 'bg-primary-100']}
            aria-current={active ? 'page' : undefined}
            onclick={() => onopen(p.id)}
          >
            <Cover cover={library.coverOf(p)} class='w-full rounded-xl' />
            <span class={['mt-2.5 block truncate text-[14px] font-500', active ? 'text-primary-950' : 'text-neutral-900']} lang={langOf(p.name)}>{p.name}</span>
            <span class={['mt-0.5 block text-[12.5px] tnum', active ? 'text-primary-900' : 'text-neutral-600']}>{formatCount(tracksOf(p.id).local.length)} 首</span>
          </button>
        </li>
      {/each}
    </ul>
  </nav>

  <div class='min-w-0 pt-2'>
    <header class='flex gap-7'>
      {#if oncover && pl.kind === 'own'}
        <button class='cover-btn relative size-[200px] flex-none rounded-2xl' aria-label='更换封面' onclick={oncover}>
          <Cover cover={library.coverOf(pl)} eager class='size-[200px] rounded-2xl shadow-ambient' />
          {#if coverBusy != null}
            <span class='absolute inset-0 grid place-items-center rounded-2xl bg-white/55'>
              <span class='ring' style:--p={coverBusy} aria-hidden='true'></span>
            </span>
          {:else}
            <span class='cover-hint absolute inset-0 grid place-items-center rounded-2xl bg-neutral-900/35 text-white' aria-hidden='true'>
              <span class='inline-flex items-center gap-1.5 text-[14px] font-500'><Camera size={18} />更换封面</span>
            </span>
          {/if}
        </button>
      {:else}
        <Cover cover={library.coverOf(pl)} eager class='size-[200px] flex-none rounded-2xl shadow-ambient' />
      {/if}
      <div class='flex min-w-0 flex-1 flex-col pt-1'>
        <h1 class='truncate text-[28px] leading-9 font-600 tracking-[-0.01em] text-neutral-900' lang={langOf(pl.name)}>{pl.name}</h1>
        <p class='mt-2 flex flex-wrap items-center gap-x-1.5 text-[14px] text-neutral-600'>
          <span lang={langOf(pl.creator)}>{pl.creator}</span>
          <span aria-hidden='true'>·</span><span>{kindLabel}</span>
          {#if pl.isPrivate}<span class='inline-flex items-center gap-1'><Lock size={13} aria-hidden='true' />隐私</span>{/if}
          <span aria-hidden='true'>·</span><span class='tnum'>{formatCount(tracks.local.length)} 首</span>
          {#if pl.playCount}<span aria-hidden='true'>·</span><span class='tnum'>播放 {formatPlays(pl.playCount)}</span>{/if}
          {#if downloaded > 0}
            <span aria-hidden='true'>·</span>
            <span class='inline-flex items-center gap-1 text-secondary-900'>
              <CircleArrowDown size={14} class='text-secondary-800' aria-hidden='true' />
              <span class='tnum'>已下载 {formatCount(downloaded)} 首</span>
            </span>
          {/if}
        </p>
        {#if pl.description}
          <p class='mt-2 max-w-[60ch] truncate text-[14px] text-neutral-600' lang={langOf(pl.description)}>{pl.description}</p>
        {/if}
        {#if pl.tags.length}
          <p class='mt-2.5 flex flex-wrap gap-1.5'>
            {#each pl.tags as t (t)}<span class='rounded-full bg-primary-100 px-2.5 text-[12px] leading-6 text-primary-950'>{t}</span>{/each}
          </p>
        {/if}

        <div class='mt-auto flex items-center gap-2 pt-4'>
          <button class='filled inline-flex h-10 items-center gap-2 rounded-full bg-primary-900 pl-4 pr-5 text-[14px] font-500 text-white' onclick={playAll}>
            <Play size={16} fill='currentColor' aria-hidden='true' />播放全部
          </button>
          <button class='tonal inline-flex h-10 items-center gap-2 rounded-full bg-secondary-100 pl-4 pr-5 text-[14px] font-500 text-secondary-900'>
            <CircleArrowDown size={16} aria-hidden='true' />下载
          </button>
          {#if view.dragVariant === 'C' && !selection.mode}
            <button class='btn-line inline-flex h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-4 pr-5 text-[14px] font-500 text-neutral-800' onclick={() => selection.enter()}>
              <ListChecks size={16} aria-hidden='true' />{sortable ? '批量操作 · 排序' : '批量操作'}
            </button>
          {/if}
          <button class='ghost grid size-10 place-items-center rounded-full text-neutral-700' aria-label='更多歌单操作' aria-haspopup='menu' onclick={onplaylistmenu}>
            <Ellipsis size={18} aria-hidden='true' />
          </button>
          <label class='search ml-auto flex h-10 w-[280px] min-w-0 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-3.5 pr-1.5'>
            <Search size={16} class='flex-none text-neutral-500' aria-hidden='true' />
            <input
              bind:value={query}
              type='search'
              class='min-w-0 flex-1 bg-transparent text-[14px] text-neutral-900 outline-none placeholder:text-neutral-500'
              placeholder='在歌单里搜索'
              aria-label='在歌单里搜索'
            />
            {#if query}
              <button class='ghost grid size-7 flex-none place-items-center rounded-full text-neutral-600' aria-label='清除搜索' onclick={() => (query = '')}>
                <X size={14} aria-hidden='true' />
              </button>
            {/if}
          </label>
        </div>
      </div>
    </header>

    <div class='mt-6 rounded-2xl bg-white p-2 shadow-ambient'>
      <div class='sticky top-16 z-10 -mx-2 -mt-2 rounded-t-2xl bg-white px-2 pt-2'>
        {#if toolbar}
          <div class='flex h-10 items-center gap-1.5 rounded-xl bg-primary-50 pl-3 pr-1' role='toolbar' aria-label='对选中的歌'>
            <span class='text-[13px] font-500 text-neutral-900 tnum' role='status'>{selection.size ? `已选 ${formatCount(selection.size)} 首` : '选择歌曲'}</span>
            <button class='link ml-1 h-8 rounded-full px-2.5 text-[13px] font-500 text-primary-900' onclick={() => selection.set(allOn ? [] : list.map(s => s.id))}>{allOn ? '全不选' : `全选 ${formatCount(list.length)} 首`}</button>
            <span class='flex-1'></span>
            <button class='pill inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-500 text-neutral-800 disabled:opacity-45' disabled={!picked.length} onclick={openAdd}>
              <ListPlus size={15} aria-hidden='true' />加入歌单
            </button>
            <button class='pill-peach inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary-100 px-3 text-[13px] font-500 text-secondary-900 disabled:opacity-45' disabled={!picked.length} onclick={() => downloadSongs(picked)}>
              <CircleArrowDown size={15} aria-hidden='true' />下载
            </button>
            {#if pl.kind === 'own'}
              <button class='pill inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-500 text-neutral-800 disabled:opacity-45' disabled={!picked.length} onclick={() => requestRemove(picked.map(s => s.id))}>
                <ListMinus size={15} aria-hidden='true' />从歌单移除
              </button>
            {:else if pl.kind === 'liked'}
              <button class='pill inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-500 text-neutral-800 disabled:opacity-45' disabled={!picked.length} onclick={() => requestRemove(picked.map(s => s.id))}>
                <HeartOff size={15} aria-hidden='true' />取消红心
              </button>
            {/if}
            <span class='mx-1 h-5 w-px bg-neutral-200' aria-hidden='true'></span>
            <button class='pill inline-flex h-8 items-center gap-1 rounded-full pl-2.5 pr-3 text-[13px] font-500 text-neutral-700' title='Esc' onclick={() => selection.exit()}>
              <X size={15} aria-hidden='true' />{view.dragVariant === 'C' && selection.mode ? '完成' : '取消选择'}
            </button>
          </div>
        {:else}
          <div class={['grid h-10 items-center gap-4 pl-2 pr-1 text-[12px] text-neutral-500', gripLead ? 'grid-cols-[24px_36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px] gap-x-3' : 'grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px]']}>
            {#if gripLead}<span></span>{/if}
            <span class='text-center'>#</span>
            <span class='pl-[52px]' role='status'>{q ? `找到 ${formatCount(list.length)} 首 / ${formatCount(tracks.local.length)}${isSortable(pl) ? ' · 搜索时不能调整顺序' : ''}` : '标题'}</span>
            <span>专辑</span>
            <span>状态</span>
            <span class='text-right'>时长</span>
            <span></span>
          </div>
        {/if}
      </div>
      {#if list.length}
        <SongList {list} plId={pl.id} {sortable} phone={false} />
      {:else}
        <p class='px-6 py-16 text-center text-[14px] text-neutral-600'>{q ? `这张歌单里没有“${query.trim()}”` : '这张歌单还没有歌'}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .side {
    scrollbar-width: none;
  }

  .search:focus-within {
    border-color: #59cfa3;
    box-shadow: 0 0 0 3px #e8f8f1;
  }

  .search input::-webkit-search-cancel-button {
    display: none;
  }

  .cover-hint {
    opacity: 0;
    transition: opacity 160ms ease-out;
  }

  .cover-btn:focus-visible .cover-hint {
    opacity: 1;
  }

  @property --p {
    syntax: '<number>';
    inherits: false;
    initial-value: 0;
  }

  .ring {
    width: 64px;
    height: 64px;
    border-radius: 9999px;
    background: conic-gradient(#206f52 calc(var(--p) * 1turn), #d1f1e3 0);
    mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px));
    transition: --p 120ms linear;
  }

  @media (hover: hover) and (pointer: fine) {
    .side-item:not([aria-current]):hover {
      background: #fff;
    }

    .filled:hover {
      background: #1a5b43;
    }

    .tonal:hover,
    .pill-peach:not(:disabled):hover {
      background: #ffe1cc;
    }

    .ghost:hover,
    .link:hover,
    .pill:not(:disabled):hover {
      background: #e8f8f1;
      color: #1a5b43;
    }

    .btn-line:hover {
      border-color: #b9ead5;
      background: #f5fcf9;
    }

    .cover-btn:hover .cover-hint {
      opacity: 1;
    }
  }
</style>
