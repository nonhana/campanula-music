<!-- PROTOTYPE（变体 C）：首次同步的进度，一条细线 + 一行字，不打断任何操作。 -->
<script lang='ts'>
  import { firstSync, formatCount } from '$lib/prototype/data'

  interface Props {
    phone?: boolean
  }

  const { phone = false }: Props = $props()

  const ratio = firstSync.tracksDone / firstSync.tracksTotal
</script>

{#if phone}
  <div class='px-4' role='status'>
    <div class='flex items-baseline justify-between gap-3 text-xs leading-[18px]'>
      <span class='text-neutral-700 font-500'>正在同步曲库</span>
      <span class='tnum text-neutral-500'>曲目 {formatCount(firstSync.tracksDone)} / {formatCount(firstSync.tracksTotal)}</span>
    </div>
    <div class='bar mt-1.5'><span style:width='{ratio * 100}%'></span></div>
    <p class='mt-1.5 truncate text-xs text-neutral-600 leading-[18px]'>
      已同步的部分可以先搜 · 歌单 {firstSync.playlistsDone}/{firstSync.playlistsTotal}，正在同步「{firstSync.current}」
    </p>
  </div>
{:else}
  <div class='flex min-w-0 items-center gap-3 text-xs leading-[18px]' role='status'>
    <div class='bar w-[120px] shrink-0'><span style:width='{ratio * 100}%'></span></div>
    <p class='min-w-0 truncate text-neutral-600'>
      <span class='text-neutral-800 font-500'>正在同步曲库</span>
      <span class='text-neutral-400'> · </span>已同步的部分可以先搜
      <span class='text-neutral-400'> · </span><span class='tnum'>歌单 {firstSync.playlistsDone}/{firstSync.playlistsTotal}，曲目 {formatCount(firstSync.tracksDone)} / {formatCount(firstSync.tracksTotal)}</span>
      <span class='text-neutral-400'> · </span>正在同步「{firstSync.current}」
    </p>
  </div>
{/if}

<style>
  .bar {
    position: relative;
    height: 3px;
    border-radius: 999px;
    background: #d1f1e3;
    overflow: hidden;
  }

  .bar > span {
    position: absolute;
    inset-block: 0;
    left: 0;
    border-radius: 999px;
    background: #37be8c;
  }
</style>
