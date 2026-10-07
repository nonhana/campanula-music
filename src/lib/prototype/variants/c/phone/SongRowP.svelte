<!-- PROTOTYPE（变体 C）：手机歌曲行（Auxio 式）。48px 封面、歌名、歌手，右边 ••• 始终可见；没有分隔线。
  第二行开头写状态：已下载 / 下载中 62% / 等待下载 / 下载失败 / 试听 / 无版权。 -->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import { ArrowDownToLine, AudioLines, CircleAlert, Ellipsis } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine } from '$lib/prototype/data'
  import { player } from '$lib/prototype/player.svelte'
  import Hl from '../Hl.svelte'
  import { ui } from '../ui.svelte'

  interface Props {
    song: Song
    query?: string
    onplay: () => void
  }

  const { song: s, query = '', onplay }: Props = $props()

  const now = $derived(player.current?.id === s.id)
</script>

<div class='row' class:now class:off={s.unavailable}>
  <button type='button' class='hit' aria-label={s.unavailable ? `${s.title}（无版权，不能播放）` : `播放 ${s.title}`} aria-disabled={s.unavailable} onclick={onplay}></button>
  <span class='dim relative shrink-0'>
    <Cover cover={s.cover} class='size-12 rounded-lg' />
    {#if now}
      <span class='absolute inset-0 grid place-items-center rounded-lg bg-[rgb(26_91_67/0.55)] text-white'>
        <AudioLines size={20} strokeWidth={2.25} aria-label='正在播放' />
      </span>
    {/if}
  </span>
  <span class='min-w-0 flex-1'>
    <span class='dim t' lang={s.lang}><Hl text={s.title} {query} /></span>
    <span class='a'>
      {#if s.unavailable}
        <span class='state text-neutral-700'>无版权</span><span class='sep'>·</span>
      {:else if s.trial}
        <span class='badge'>试听</span>
      {/if}
      {#if s.download === 'done'}
        <ArrowDownToLine size={14} class='shrink-0 text-secondary-800' aria-label='已下载' />
      {:else if s.download === 'downloading'}
        <span class='dl'><span style:width='{(s.downloadProgress ?? 0) * 100}%'></span></span>
        <span class='state tnum text-secondary-900'>下载中 {Math.round((s.downloadProgress ?? 0) * 100)}%</span><span class='sep'>·</span>
      {:else if s.download === 'queued'}
        <span class='state text-neutral-600'>等待下载</span><span class='sep'>·</span>
      {:else if s.download === 'failed'}
        <CircleAlert size={14} class='shrink-0 text-error-700' aria-hidden='true' />
        <span class='state text-error-700'>下载失败</span><span class='sep'>·</span>
      {/if}
      <span class='dim min-w-0 truncate' lang={s.lang}><Hl text={artistLine(s)} {query} /></span>
    </span>
  </span>
  <button type='button' class='more' aria-label='{s.title} 的更多操作' aria-haspopup='menu' onclick={e => ui.openMenu(s, e, true)}>
    <Ellipsis size={20} aria-hidden='true' />
  </button>
</div>

<style>
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    height: 100%;
    padding: 0 4px 0 16px;
  }

  .row.now {
    background: #f5fcf9;
  }

  .row > :not(.hit, .more) {
    pointer-events: none;
  }

  .hit {
    position: absolute;
    inset: 0;
    z-index: 1;
    outline-offset: -2px;
  }

  .hit:active:not([aria-disabled='true']) {
    background: rgb(209 241 227 / 0.4);
  }

  .more {
    position: relative;
    z-index: 2;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 8px;
    color: #4b5563;
  }

  .t {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 500;
    line-height: 22px;
    color: #111827;
  }

  .now .t {
    color: #206f52;
  }

  .a {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    margin-top: 1px;
    font-size: 13px;
    line-height: 20px;
    color: #4b5563;
  }

  .state {
    flex-shrink: 0;
    font-weight: 500;
  }

  .sep {
    flex-shrink: 0;
    color: #9ca3af;
  }

  .badge {
    flex-shrink: 0;
    height: 18px;
    padding: 0 5px;
    border-radius: 4px;
    background: #fff8e1;
    color: #bf360c;
    font-size: 11px;
    font-weight: 500;
    line-height: 18px;
  }

  .dl {
    position: relative;
    flex-shrink: 0;
    width: 28px;
    height: 4px;
    border-radius: 999px;
    background: #ffeee2;
    overflow: hidden;
  }

  .dl > span {
    position: absolute;
    inset-block: 0;
    left: 0;
    border-radius: 999px;
    background: #ff8f55;
  }

  .row.off :global(.dim) {
    opacity: 0.45;
  }
</style>
