<!--
  下载完成的那一行：保留封面、歌名和原行结构，只把状态换成勾；沿用原来的等待时间后整行在原地淡出。
  退场是一个动作：淡出和行高收到 0 同时开始、同时到位（200ms，先快后慢），外侧面板跟着连续变矮，
  下方行一起被推上去，不会等移除后突然跳一下；不再往外横着滑——横滑和收高度分成两个动作会显得一顿一顿。
  父级负责 key、行高和下方 FLIP；这里只管完成状态和高度收起。
-->
<script lang='ts'>
  import type { DownloadTask } from '#lib/app/downloads.js'

  import DownloadTaskRow from './DownloadTaskRow.svelte'

  const { content, phase, paused, online, signedIn }: {
    content: DownloadTask
    phase: 'run' | 'exit'
    paused: boolean
    online: boolean
    signedIn: boolean
  } = $props()
</script>

<div class={[
  'leaving-shell',
  phase === 'exit' && 'leaving-exit',
]} aria-hidden='true'>
  <div class='min-h-0 overflow-hidden'>
    <DownloadTaskRow
      task={content}
      variant='panel'
      completed
      {paused}
      {online}
      {signedIn}
    />
  </div>
</div>

<style>
  .leaving-shell {
    display: grid;
    grid-template-rows: 1fr;
    transition:
      grid-template-rows var(--move-state) var(--ease-out-soft),
      opacity var(--duration-state) var(--ease-out-soft);
  }

  .leaving-exit {
    grid-template-rows: 0fr;
    opacity: 0;
  }
</style>
