<!--
  桌面歌曲行、播放队列最左边的序号列（DESIGN.md Song Row · 点歌、Morning Row）：正在放的那行换成三根小竖条。
  换上这一行时序号淡出、竖条从底下长出来（200ms）；换走时竖条缩回去（120ms）、序号淡回来。
  新旧叠在同一个网格格子里。挂上时已经在放的（虚拟列表滚出来的行）不长。减少动态效果时只交叉淡化
-->
<script lang='ts'>
  import { fade, grow } from '../shared/motion'
  import { DURATIONS } from '../shared/motion-tokens'
  import NowBars from './NowBars.svelte'

  /** n：序号，从 1 开始；now：这一行正在放 */
  const { n, now }: { n: number, now: boolean } = $props()
</script>

<span class='grid place-items-center text-caption text-neutral-500 tabular-nums'>
  {#if now}
    <span class='grid col-start-1 row-start-1 origin-bottom' in:grow out:grow><NowBars /></span>
  {:else}
    <span class='col-start-1 row-start-1' in:fade out:fade={{ duration: DURATIONS['state-out'] }}>{n}</span>
  {/if}
</span>
