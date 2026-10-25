<!--
  歌曲行上的下载标记（DESIGN.md Song Row · 状态，原型 DownloadMark）：已下载是蜜桃枝的下载图标；排队中是石墨的时钟；下载中是蜜桃的细进度条和百分数（不知道总大小时只写“下载中”，#78）；
  下载失败只有出错红的感叹号，“下载失败”是读屏名字和悬停提示。column：桌面歌曲行的状态列；inline：手机行、首页歌曲格里歌手前面（只有图标和百分数，文字给读屏）
-->
<script lang='ts'>
  import { CircleAlert, CircleArrowDown, Clock } from '@lucide/svelte'

  import type { DownloadMark } from './song-look'

  const { mark, variant }: { mark: DownloadMark, variant: 'column' | 'inline' } = $props()
  const size = $derived(variant === 'inline'
    ? 14
    : 16)
</script>

{#if mark.kind === 'done'}
  <span class='flex flex-none text-secondary-800' title='已下载'>
    <CircleArrowDown {size} aria-hidden='true' />
    <span class='sr-only'>已下载</span>
  </span>
{:else if mark.kind === 'queued'}
  <span class='flex flex-none items-center gap-1 text-neutral-500' title='排队中'>
    <Clock {size} aria-hidden='true' />
    {#if variant === 'column'}<span class='text-caption' aria-hidden='true'>排队中</span>{/if}
    <span class='sr-only'>排队中</span>
  </span>
{:else if mark.kind === 'downloading'}
  {@const label = mark.percent === null
    ? '下载中'
    : `下载中 ${mark.percent}%`}
  <span class='flex flex-none items-center gap-1.5' title={label}>
    {#if variant === 'column'}
      <span class='h-[3px] w-6 overflow-hidden rounded-full bg-secondary-100' aria-hidden='true'>
        <span class='block h-full rounded-full bg-secondary-700' style:width='{mark.percent ?? 0}%'></span>
      </span>
    {/if}
    <span class='text-caption text-secondary-900 font-500 tabular-nums' aria-hidden='true'>{mark.percent === null
      ? '下载中'
      : `${mark.percent}%`}</span>
    <span class='sr-only'>{label}</span>
  </span>
{:else}
  <span class='flex flex-none text-error-700' title='下载失败'>
    <CircleAlert {size} aria-hidden='true' />
    <span class='sr-only'>下载失败</span>
  </span>
{/if}
