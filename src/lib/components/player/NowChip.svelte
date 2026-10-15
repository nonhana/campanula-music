<!--
  封面中间“正在播放”的小圆片（DESIGN.md Morning Row）：28px 白色圆片里是三根小竖条，封面本身不被盖掉。放在 position: relative 的封面上。
  换上这一行时带着竖条淡入（200ms），换走时淡出（120ms）（DESIGN.md Song Row · 点歌）；挂上时已经在放的（虚拟列表滚出来的行）不淡
-->
<script lang='ts'>
  import { fade } from '../motion'
  import { DURATIONS } from '../motion-tokens'
  import NowBars from './NowBars.svelte'
</script>

<span class='pointer-events-none absolute inset-0 grid place-items-center' aria-hidden='true' in:fade out:fade={{ duration: DURATIONS['state-out'] }}>
  <span class='grid size-7 place-items-center rounded-full bg-white/92 shadow-chip'><NowBars /></span>
</span>
