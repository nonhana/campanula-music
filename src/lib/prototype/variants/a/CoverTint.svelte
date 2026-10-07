<!--
  PROTOTYPE：播放页的封面染底。当前封面放大、重度模糊，盖一层白纱，让每首歌把页面染成自己的颜色，同时保持明亮、字可读。
  换歌时交叉淡入；减少动态效果时直接切换。
-->
<script lang='ts'>
  import { coverSrc } from '$lib/prototype/data'
  import { fade } from 'svelte/transition'

  interface Props {
    cover: string
    /** 白纱不透明度；0.8 时深色封面上的 neutral-600 字仍有 4.5:1 以上 */
    veil?: number
  }

  const { cover, veil = 0.8 }: Props = $props()

  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const dur = reduce ? 0 : 700
</script>

<div class='tint' aria-hidden='true'>
  {#key cover}
    <img src={coverSrc(cover)} alt='' draggable='false' transition:fade={{ duration: dur }} />
  {/key}
  <div class='veil' style:--veil={veil}></div>
</div>

<style>
  .tint {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #fff;
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
    background: rgb(255 255 255 / var(--veil));
  }
</style>
