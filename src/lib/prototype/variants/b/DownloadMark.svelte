<!-- PROTOTYPE · 歌曲的下载状态：已下载（蜜桃色图标）、下载中进度、等待下载、下载失败。 -->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import { ArrowDownToLine, CircleAlert, Clock } from '@lucide/svelte'

  interface Props {
    song: Song
    /** 手机行内：更小，只在需要时出字 */
    inline?: boolean
  }

  const { song, inline = false }: Props = $props()
  const pct = $derived(Math.round((song.downloadProgress ?? 0) * 100))
</script>

{#if song.download === 'done'}
  <span class='mark done' title='已下载'>
    <ArrowDownToLine size={inline ? 13 : 15} strokeWidth={2.25} aria-label='已下载' />
  </span>
{:else if song.download === 'downloading'}
  <span class='mark loading' title='下载中 {pct}%'>
    {#if inline}
      <span class='txt'>下载中</span>
    {/if}
    <span class='bar' aria-hidden='true'><span style:width='{pct}%'></span></span>
    <span class='txt tnum'>{pct}%</span>
  </span>
{:else if song.download === 'queued'}
  <span class='mark queued'>
    <Clock size={inline ? 12 : 14} strokeWidth={2} aria-hidden='true' />
    <span class='txt'>等待下载</span>
  </span>
{:else if song.download === 'failed'}
  <span class='mark failed'>
    <CircleAlert size={inline ? 12 : 14} strokeWidth={2.25} aria-hidden='true' />
    <span class='txt'>下载失败</span>
  </span>
{/if}

<style>
  .mark {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    line-height: 16px;
    white-space: nowrap;
  }

  .done {
    color: #e6601f;
  }

  .loading {
    color: #b34719;
  }

  .bar {
    position: relative;
    width: 36px;
    height: 3px;
    border-radius: 9999px;
    background: #ffe1cc;
    overflow: hidden;
  }

  .bar span {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: inherit;
    background: #ff8f55;
  }

  .queued {
    color: #6b7280;
  }

  .failed {
    color: #d32f2f;
  }
</style>
