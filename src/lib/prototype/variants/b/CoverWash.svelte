<!--
  PROTOTYPE · 封面染色的晨光底：把当前封面放大、重度模糊，再盖一层白纱。颜色全部来自封面本身。
-->
<script lang='ts'>
  import { coverSrc } from '$lib/prototype/data'

  interface Props {
    cover: string
    /** 白纱的不透明度，越大越淡 */
    veil?: number
  }

  const { cover, veil = 0.72 }: Props = $props()
</script>

<div class='wash' aria-hidden='true'>
  <img src={coverSrc(cover)} alt='' draggable='false' />
  <div class='veil' style:--veil={veil}></div>
</div>

<style>
  .wash {
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
