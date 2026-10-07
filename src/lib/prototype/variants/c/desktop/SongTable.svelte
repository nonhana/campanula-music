<!-- PROTOTYPE（变体 C）：桌面的密集歌曲表。表头可排序，48px 行，单击整行播放，••• 始终可见，右键同一菜单。 -->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import type { PlaySource } from '$lib/prototype/player.svelte'
  import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpDown, AudioLines, CircleAlert, Ellipsis, Play } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, formatDuration } from '$lib/prototype/data'
  import { player } from '$lib/prototype/player.svelte'
  import VirtualList from '$lib/prototype/VirtualList.svelte'
  import Hl from '../Hl.svelte'
  import { ui } from '../ui.svelte'

  type SortKey = 'title' | 'album' | 'added' | 'duration'

  interface Props {
    songs: Song[]
    query?: string
    source: PlaySource
    /** 表头吸顶的位置（px） */
    stickyTop?: number
  }

  const { songs, query = '', source, stickyTop = 72 }: Props = $props()

  let sortKey = $state<SortKey | null>(null)
  let sortDir = $state<'asc' | 'desc'>('asc')

  const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' })

  const sorted = $derived.by(() => {
    if (!sortKey)
      return songs
    const k = sortKey
    const dir = sortDir === 'asc' ? 1 : -1
    const out = songs.slice()
    out.sort((a, b) => {
      let c = 0
      if (k === 'title')
        c = collator.compare(a.title, b.title)
      else if (k === 'album')
        c = collator.compare(a.album, b.album)
      else if (k === 'added')
        c = a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0
      else c = a.duration - b.duration
      return c * dir
    })
    return out
  })

  /** 第一次升序，第二次降序，第三次回到默认顺序（最近红心在前） */
  function cycle(k: SortKey) {
    if (sortKey !== k) {
      sortKey = k
      sortDir = k === 'added' ? 'desc' : 'asc'
    }
    else if ((k === 'added' && sortDir === 'desc') || (k !== 'added' && sortDir === 'asc')) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc'
    }
    else {
      sortKey = null
    }
  }

  function ariaSort(k: SortKey) {
    if (sortKey !== k)
      return 'none'
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }

  function play(i: number) {
    player.playFrom(sorted, i, source)
  }
</script>

{#snippet head(k: SortKey, label: string, end = false)}
  <div role='columnheader' aria-sort={ariaSort(k)} class:justify-end={end} class='flex'>
    <button type='button' class='sort' class:on={sortKey === k} onclick={() => cycle(k)}>
      <span>{label}</span>
      {#if sortKey === k}
        {#if sortDir === 'asc'}
          <ArrowUp size={14} strokeWidth={2.25} aria-hidden='true' />
        {:else}
          <ArrowDown size={14} strokeWidth={2.25} aria-hidden='true' />
        {/if}
      {:else}
        <ArrowUpDown size={13} class='text-neutral-400' aria-hidden='true' />
      {/if}
    </button>
  </div>
{/snippet}

<div role='table' aria-label='歌曲' aria-rowcount={sorted.length + 1}>
  <div class='head grid-cols' role='row' style:top='{stickyTop}px'>
    <div role='columnheader' class='flex justify-center'>
      <button type='button' class='sort' class:on={sortKey === null} onclick={() => (sortKey = null)} title='恢复默认顺序'>#</button>
    </div>
    {@render head('title', '歌名')}
    {@render head('album', '专辑')}
    {@render head('added', '加入时间')}
    <div role='columnheader' class='px-1 text-neutral-500'>下载</div>
    {@render head('duration', '时长', true)}
    <div role='columnheader'><span class='sr-only'>更多操作</span></div>
  </div>

  {#if sorted.length === 0}
    <div class='py-16 text-center text-sm text-neutral-500'>没有符合条件的歌曲。</div>
  {:else}
    <VirtualList items={sorted} itemHeight={48} getKey={(s, i) => `${s.id}:${i}`}>
      {#snippet row(s: Song, i: number)}
        {@const now = player.current?.id === s.id}
        <div
          class='row grid-cols'
          class:now
          class:off={s.unavailable}
          role='row'
          aria-rowindex={i + 2}
          oncontextmenu={(e) => {
            e.preventDefault()
            ui.openMenu(s, e, false)
          }}
        >
          <button
            type='button'
            class='hit'
            aria-label={s.unavailable ? `${s.title}（无版权，不能播放）` : `播放 ${s.title}`}
            aria-disabled={s.unavailable}
            onclick={() => play(i)}
          ></button>
          <div role='cell' class='idx'>
            {#if now}
              <AudioLines size={16} strokeWidth={2.25} class='text-primary-800' aria-label='正在播放' />
            {:else}
              <span class='num tnum'>{i + 1}</span>
              {#if !s.unavailable}<Play size={14} class='play-hint text-neutral-700' fill='currentColor' aria-hidden='true' />{/if}
            {/if}
          </div>
          <div role='cell' class='flex min-w-0 items-center gap-3'>
            <Cover cover={s.cover} class='size-9 shrink-0 rounded-md' />
            <div class='dim min-w-0'>
              <div class='flex min-w-0 items-center gap-1.5'>
                <span class='title truncate' lang={s.lang}><Hl text={s.title} {query} /></span>
                {#if s.trial}<span class='badge trial'>试听</span>{/if}
                {#if s.unavailable}<span class='badge gone'>无版权</span>{/if}
              </div>
              <div class='sub truncate' lang={s.lang}><Hl text={artistLine(s)} {query} /></div>
            </div>
          </div>
          <div role='cell' class='dim sub2 truncate' lang={s.lang}><Hl text={s.album} {query} /></div>
          <div role='cell' class='dim tnum text-xs text-neutral-500'>{s.addedAt}</div>
          <div role='cell' class='flex items-center gap-1.5 px-1 text-xs'>
            {#if s.download === 'done'}
              <span class='text-secondary-800' title='已下载'><ArrowDownToLine size={16} aria-hidden='true' /><span class='sr-only'>已下载</span></span>
            {:else if s.download === 'downloading'}
              <span class='dl-bar'><span style:width='{(s.downloadProgress ?? 0) * 100}%'></span></span>
              <span class='tnum text-secondary-900 font-500'>{Math.round((s.downloadProgress ?? 0) * 100)}%</span>
            {:else if s.download === 'queued'}
              <span class='text-neutral-500'>等待下载</span>
            {:else if s.download === 'failed'}
              <CircleAlert size={14} class='shrink-0 text-error-700' aria-hidden='true' />
              <span class='text-error-700'>下载失败</span>
            {/if}
          </div>
          <div role='cell' class='dim tnum text-right text-xs text-neutral-500'>{formatDuration(s.duration)}</div>
          <div role='cell' class='flex justify-center'>
            <button type='button' class='more' aria-label='{s.title} 的更多操作' aria-haspopup='menu' onclick={e => ui.openMenu(s, e, false)}>
              <Ellipsis size={18} aria-hidden='true' />
            </button>
          </div>
        </div>
      {/snippet}
    </VirtualList>
  {/if}
</div>

<style>
  .grid-cols {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) minmax(0, 0.62fr) 104px 104px 56px 48px;
    align-items: center;
    column-gap: 12px;
  }

  .head {
    position: sticky;
    z-index: 5;
    height: 40px;
    background: #fff;
    box-shadow: inset 0 -1px 0 #f3f4f6;
    font-size: 12px;
    color: #4b5563;
  }

  .sort {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 4px;
    margin-inline: -4px;
    border-radius: 6px;
    font-weight: 500;
    color: #4b5563;
  }

  .sort.on {
    color: #206f52;
    font-weight: 600;
  }

  .row {
    position: relative;
    height: 48px;
    border-radius: 8px;
  }

  .row.now {
    background: #e8f8f1;
  }

  .row.off .dim,
  .row.off .idx,
  .row.off :global(img) {
    opacity: 0.45;
  }

  .hit {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    border-radius: 8px;
    cursor: pointer;
    outline-offset: -2px;
  }

  .hit[aria-disabled='true'] {
    cursor: default;
  }

  .row > :not(.hit) {
    pointer-events: none;
  }

  .row > :last-child {
    position: relative;
    z-index: 2;
    pointer-events: auto;
  }

  .idx {
    display: grid;
    place-items: center;
    font-size: 12px;
    color: #6b7280;
  }

  .idx > :global(*) {
    grid-area: 1 / 1;
  }

  .idx :global(.play-hint) {
    opacity: 0;
  }

  .title {
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    color: #111827;
  }

  .row.now .title {
    color: #206f52;
  }

  .sub {
    font-size: 12px;
    line-height: 16px;
    color: #4b5563;
  }

  .sub2 {
    font-size: 13px;
    color: #4b5563;
  }

  .badge {
    flex-shrink: 0;
    height: 18px;
    padding: 0 5px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    line-height: 18px;
  }

  .badge.trial {
    background: #fff8e1;
    color: #bf360c;
  }

  .badge.gone {
    background: #f3f4f6;
    color: #374151;
  }

  .dl-bar {
    position: relative;
    width: 36px;
    height: 4px;
    border-radius: 999px;
    background: #ffeee2;
    overflow: hidden;
  }

  .dl-bar > span {
    position: absolute;
    inset-block: 0;
    left: 0;
    background: #ff8f55;
    border-radius: 999px;
  }

  .more {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: #4b5563;
  }

  @media (hover: hover) and (pointer: fine) {
    .row:not(.now):hover {
      background: #f9fafb;
    }

    .row:not(.off):hover .num {
      opacity: 0;
    }

    .row:not(.off):hover :global(.play-hint) {
      opacity: 1;
    }

    .more:hover {
      background: #d1f1e3;
      color: #1a5b43;
    }

    .sort:hover {
      color: #111827;
    }
  }
</style>
