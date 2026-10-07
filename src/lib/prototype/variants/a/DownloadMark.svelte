<!--
  PROTOTYPE：一首歌在这台设备上的下载状态。
  variant：column（桌面列表的状态列，带文字）、icon（首页歌曲格，只放图标）、inline（手机行第二行开头，带短文字）。
-->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import { CircleAlert, CircleArrowDown, Clock } from '@lucide/svelte'

  interface Props {
    song: Song
    variant?: 'column' | 'icon' | 'inline'
  }

  const { song, variant = 'column' }: Props = $props()

  const pct = $derived(Math.round((song.downloadProgress ?? 0) * 100))
  const size = $derived(variant === 'inline' ? 14 : 16)
</script>

{#if song.download === 'done'}
  <span class='inline-flex items-center text-secondary-800' title='已下载'>
    <CircleArrowDown {size} strokeWidth={2} aria-label='已下载' />
  </span>
{:else if song.download === 'downloading'}
  <span class='inline-flex items-center gap-1.5 text-secondary-900' title='下载中 {pct}%'>
    {#if variant !== 'icon'}
      <span class='relative h-[3px] w-6 overflow-hidden rounded-full bg-secondary-100'>
        <span class='absolute inset-y-0 left-0 rounded-full bg-secondary-700' style:width='{pct}%'></span>
      </span>
    {/if}
    <span class='tnum text-[12px] leading-4 font-500'>{pct}%</span>
    <span class='sr-only'>下载中</span>
  </span>
{:else if song.download === 'queued'}
  <span class='inline-flex items-center gap-1 text-neutral-500' title='等待下载'>
    <Clock {size} strokeWidth={2} aria-hidden='true' />
    <span class={['text-[12px] leading-4', variant === 'icon' && 'sr-only']}>等待下载</span>
  </span>
{:else if song.download === 'failed'}
  <span class='inline-flex items-center gap-1 text-error-700' title='下载失败'>
    <CircleAlert {size} strokeWidth={2} aria-hidden='true' />
    <span class={['text-[12px] leading-4', variant === 'icon' && 'sr-only']}>下载失败</span>
  </span>
{/if}
