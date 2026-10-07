<!--
  PROTOTYPE：变体 A · 分区首页。桌面打开就是整个曲库的分区总览（我喜欢的音乐、歌单、专辑、歌手一屏可见），
  手机保留 Auxio 式文字标签。签名：“晨光行”——正在播放的那一行被浅薄荷光随进度从左铺到右。
-->
<script lang='ts'>
  import { MediaQuery } from 'svelte/reactivity'
  import DesktopShell from './DesktopShell.svelte'
  import PhoneShell from './PhoneShell.svelte'
  import SongMenu from './SongMenu.svelte'

  const wide = new MediaQuery('min-width: 768px')
</script>

<div class='variant-a'>
  {#if wide.current}
    <DesktopShell />
  {:else}
    <PhoneShell />
  {/if}
  <SongMenu phone={!wide.current} />
</div>

<style>
  .variant-a :global(.spin) {
    animation: a-spin 2.4s linear infinite;
  }

  @keyframes a-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .variant-a :global(.spin) {
      animation: none;
    }
  }
</style>
