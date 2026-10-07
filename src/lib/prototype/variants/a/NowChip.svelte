<!--
  PROTOTYPE：封面上的“正在播放”小圆片——白底上三根薄荷竖条。只占封面中间一小块，封面本身的颜色不被盖掉。
-->
<script lang='ts'>
  import { player } from '$lib/prototype/player.svelte'
  import NowBars from './NowBars.svelte'
</script>

<span class='pointer-events-none absolute inset-0 grid place-items-center' aria-hidden='true'>
  <span class='chip grid size-7 place-items-center rounded-full bg-white/92'>
    <NowBars playing={player.playing} />
  </span>
</span>

<style>
  .chip {
    box-shadow: 0 1px 3px rgb(17 24 39 / 0.18);
  }
</style>
