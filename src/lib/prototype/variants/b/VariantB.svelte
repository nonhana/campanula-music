<!--
  PROTOTYPE · 变体 B「歌词舞台」：正在听的那首歌是重心，歌词是它的舞台。
  曲库是一条安静的标签脊梁；播放页把整个屏幕变成被封面颜色照亮的歌词舞台。
  标志动作「逐字晨光」：已唱的部分逐字染成深墨，未唱的部分留在浅灰（舞台、手机歌词条、迷你播放条、桌面底栏）。
-->
<script lang='ts'>
  import { page } from '$app/state'
  import { MediaQuery } from 'svelte/reactivity'
  import { clock, startClock } from './clock.svelte'
  import DesktopShell from './DesktopShell.svelte'
  import PhoneShell from './PhoneShell.svelte'
  import SongMenu from './SongMenu.svelte'
  import Toast from './Toast.svelte'

  const desktop = new MediaQuery('min-width: 768px')
  const still = page.url.searchParams.get('still') === '1'
  clock.still = still

  $effect(() => {
    if (!still)
      return startClock()
  })
</script>

<div class='vb'>
  {#if desktop.current}
    <DesktopShell />
  {:else}
    <PhoneShell />
  {/if}
  <SongMenu phone={!desktop.current} />
  <Toast bottom={desktop.current ? 96 : 80} />
</div>

<style>
  .vb {
    min-height: 100dvh;
    background: #fff;
    color: #111827;
  }

  .vb :global(button) {
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;
  }

  .vb :global(button:disabled) {
    cursor: default;
  }
</style>
