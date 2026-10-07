<!--
  PROTOTYPE · 桌面的密排歌曲行（52px）：序号/正在播放、封面 40、歌名+歌手、专辑、状态、时长、•••。
  单击整行播放；••• 始终可见；右键打开同一个菜单。
-->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, formatDuration } from '$lib/prototype/data'
  import { player } from '$lib/prototype/player.svelte'
  import { Ellipsis, Play } from '@lucide/svelte'
  import Bars from './Bars.svelte'
  import DownloadMark from './DownloadMark.svelte'
  import Tag from './Tag.svelte'
  import { ui } from './ui.svelte'

  interface Props {
    song: Song
    /** 显示的序号（从 1 开始） */
    number: number
    onplay: () => void
  }

  const { song, number, onplay }: Props = $props()

  const isCurrent = $derived(player.current?.id === song.id)

  function openFrom(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    ui.openMenu(song, rect.right, rect.bottom + 4)
  }

  function oncontextmenu(e: MouseEvent) {
    e.preventDefault()
    if (e.clientX === 0 && e.clientY === 0) {
      // 键盘的菜单键：贴着行出现
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      ui.openMenu(song, rect.right - 48, rect.bottom)
      return
    }
    ui.openMenu(song, e.clientX, e.clientY)
  }
</script>

<div class={['row', isCurrent && 'current', song.unavailable && 'off']} {oncontextmenu} role='presentation'>
  <button
    type='button'
    class='hit'
    aria-label={song.unavailable ? `${song.title}，无版权，不能播放` : `播放 ${song.title}`}
    disabled={song.unavailable}
    onclick={onplay}
  ></button>
  <span class='num tnum'>
    {#if isCurrent}
      <Bars playing={player.playing} />
    {:else}
      {number}
    {/if}
  </span>
  <span class='main'>
    <span class='cover'>
      <Cover cover={song.cover} class='img' />
      <span class='hint' aria-hidden='true'><Play size={16} fill='currentColor' strokeWidth={0} /></span>
    </span>
    <span class='text'>
      <span class='title-line'>
        <span class='title' lang={song.lang}>{song.title}</span>
        {#if song.trial}<Tag kind='trial' />{/if}
        {#if song.unavailable}<Tag kind='nocopy' />{/if}
      </span>
      <span class='artist' lang={song.lang}>{artistLine(song)}</span>
    </span>
  </span>
  <span class='album' lang={song.lang}>{song.album}</span>
  <span class='state'><DownloadMark {song} /></span>
  <span class='dur tnum'>{formatDuration(song.duration)}</span>
  <button type='button' class='more' aria-label='更多操作：{song.title}' aria-haspopup='menu' onclick={openFrom}>
    <Ellipsis size={18} strokeWidth={2} />
  </button>
</div>

<style>
  .row {
    position: relative;
    display: grid;
    grid-template-columns: 36px minmax(0, 1.6fr) minmax(0, 1fr) 112px 44px 36px;
    align-items: center;
    column-gap: 16px;
    height: 52px;
    padding: 0 8px 0 12px;
    border-radius: 10px;
    transition: background-color 120ms;
  }

  .hit {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    cursor: pointer;
  }

  .hit:disabled {
    cursor: not-allowed;
  }

  .hit:focus-visible {
    outline-offset: -2px;
  }

  .num,
  .main,
  .album,
  .state,
  .dur {
    position: relative;
    pointer-events: none;
  }

  .num {
    display: flex;
    justify-content: center;
    font-size: 13px;
    color: #6b7280;
  }

  .main {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .cover {
    position: relative;
    flex: none;
    width: 40px;
    height: 40px;
  }

  .cover :global(.img) {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    background: #f3f4f6;
  }

  .hint {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: 6px;
    background: rgb(17 24 39 / 0.42);
    color: #fff;
    opacity: 0;
    transition: opacity 140ms;
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .title-line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    line-height: 22px;
    font-weight: 500;
    color: #111827;
  }

  .artist,
  .album {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12.5px;
    line-height: 18px;
    color: #4b5563;
  }

  .album {
    font-size: 13px;
  }

  .state {
    display: flex;
    align-items: center;
  }

  .dur {
    text-align: right;
    font-size: 13px;
    color: #6b7280;
  }

  .more {
    position: relative;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 9999px;
    color: #6b7280;
  }

  .current {
    background: #f5fcf9;
  }

  .current .title {
    color: #206f52;
  }

  .off .main,
  .off .album,
  .off .num,
  .off .dur {
    opacity: 0.45;
  }

  @media (hover: hover) and (pointer: fine) {
    .row:hover {
      background: #f9fafb;
    }

    .row.current:hover {
      background: #e8f8f1;
    }

    .row:not(.off):hover .hint {
      opacity: 1;
    }

    .more:hover {
      background: #f3f4f6;
      color: #111827;
    }
  }
</style>
