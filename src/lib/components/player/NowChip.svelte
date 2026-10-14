<!--
  封面中间“正在播放”的小圆片（DESIGN.md Morning Row）：28px 白色圆片里是三根小竖条，封面本身不被盖掉。放在 position: relative 的封面上
-->
<script lang='ts'>
  import NowBars from './NowBars.svelte'
</script>

<span class='pointer-events-none absolute inset-0 grid place-items-center' aria-hidden='true'>
  <span class='grid size-7 place-items-center rounded-full bg-white/92 shadow-chip'><NowBars /></span>
</span>
