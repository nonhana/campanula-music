<!--
  播放页的封面染底（DESIGN.md Elevation & Depth）：当前封面放大、重度模糊（64px，饱和度 1.15），盖一层 80% 的白纱，
  每首歌把页面染成自己的颜色，同时保持明亮、字可读（The Light-Only Fog Rule）。换歌时交叉淡入；减少动态效果时直接换。
  模糊得很重，取一张小缩略图就够。铺满 position: relative（或 fixed）的容器
-->
<script lang='ts'>
  import { prefersReducedMotion } from 'svelte/motion'
  import { fade } from 'svelte/transition'
  import { thumbnailUrl } from '../library/view'

  const { coverUrl }: { coverUrl: string } = $props()
  const source = $derived(thumbnailUrl(coverUrl, 240))
</script>

<div class='tint' aria-hidden='true'>
  {#key source}
    <img src={source} alt='' draggable='false' transition:fade={{ duration: prefersReducedMotion.current ? 0 : 700 }} />
  {/key}
  <div class='veil'></div>
</div>

<style>
  .tint {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: theme('colors.primary.50');
    pointer-events: none;
  }

  img {
    position: absolute;
    inset: -20%;
    width: 140%;
    height: 140%;
    max-width: none;
    object-fit: cover;
    filter: blur(64px) saturate(1.15);
    transform: translateZ(0);
  }

  .veil {
    position: absolute;
    inset: 0;
    background: rgb(255 255 255 / 0.8);
  }
</style>
