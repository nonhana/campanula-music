<!--
  下载完成的那一行：原位置先让内容向右滑出，露出底下的“已下载《歌名》”；停一下整行在原地淡出。
  退场是一个动作：淡出和行高收到 0 同时开始、同时到位（200ms，先快后慢），外侧面板跟着连续变矮，
  下方行一起被推上去，不会等移除后突然跳一下；不再往外横着滑——横滑和收高度分成两个动作会显得一顿一顿。
  父级负责 key、行高和下方 FLIP；这里只管两层的内容、横向露出和高度收起。
-->
<script lang='ts'>
  import { Check } from '@lucide/svelte'

  import type { DownloadTask } from '#lib/app/downloads.js'

  import DownloadTaskRow from './DownloadTaskRow.svelte'

  const { name, content, phase, paused, online, signedIn }: {
    name: string
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
    <div class='relative overflow-hidden'>
      <div class='absolute inset-0 flex items-center gap-2 bg-white px-2 text-caption text-neutral-700' aria-hidden='true'>
        <Check size={16} class='flex-none text-secondary-800' />
        <span class='truncate'>已下载《{name}》</span>
      </div>
      <div class='leaving-content relative bg-white'>
        <DownloadTaskRow
          task={content}
          variant='panel'
          readonly
          {paused}
          {online}
          {signedIn}
          speed={null}
          oncancel={() => {}}
          onretry={() => {}}
        />
      </div>
    </div>
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

  .leaving-content {
    animation: leaving-reveal var(--move-state) var(--ease-out-soft) forwards;
  }

  .leaving-exit {
    grid-template-rows: 0fr;
    opacity: 0;
  }

  @keyframes leaving-reveal {
    to {
      transform: translateX(100%);
    }
  }
</style>
