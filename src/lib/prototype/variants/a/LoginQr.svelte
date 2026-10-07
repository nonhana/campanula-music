<!--
  PROTOTYPE：登录二维码。真实编码 https://campanula.caelum.moe/prototype（qrcode，纠错 M，29×29），
  原型里不会真的完成登录。模块用深绿画，四周留白由外框负责。
-->
<script lang='ts' module>
  const d = 'M0 0.5h7m1 0h1m5 0h1m1 0h1m2 0h2m1 0h7M0 1.5h1m5 0h1m1 0h2m1 0h1m2 0h1m1 0h3m1 0h1m1 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m3 0h2m1 0h1m2 0h1m1 0h3m1 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m1 0h3m2 0h2m1 0h2m1 0h1m2 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m2 0h4m1 0h3m2 0h1m2 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m3 0h2m1 0h2m1 0h1m1 0h3m1 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M8 7.5h4m4 0h3M0 8.5h1m1 0h2m1 0h3m1 0h1m1 0h1m1 0h1m3 0h1m1 0h1m2 0h1m2 0h1m1 0h2M0 9.5h3m2 0h1m4 0h1m1 0h2m2 0h9m3 0h1M0 10.5h2m1 0h1m1 0h2m2 0h2m2 0h1m2 0h1m1 0h1m4 0h1m2 0h2M2 11.5h1m2 0h1m2 0h3m1 0h1m2 0h1m3 0h1m1 0h2m5 0h1M0 12.5h3m1 0h1m1 0h6m2 0h1m2 0h1m5 0h1m1 0h2M1 13.5h2m7 0h1m3 0h3m2 0h1m2 0h1m3 0h3M0 14.5h1m5 0h1m3 0h1m2 0h1m2 0h1m1 0h4m1 0h1m2 0h3M0 15.5h4m1 0h1m1 0h1m2 0h1m1 0h1m1 0h3m2 0h1m1 0h3m3 0h1M1 16.5h7m1 0h3m2 0h1m1 0h1m1 0h1m1 0h2m1 0h3m1 0h1M4 17.5h2m3 0h1m2 0h1m1 0h2m1 0h1m2 0h2m1 0h1m1 0h3M0 18.5h1m1 0h2m2 0h3m4 0h5m5 0h2m1 0h1M2 19.5h1m2 0h1m1 0h4m1 0h8m1 0h1m1 0h1m2 0h1M1 20.5h2m1 0h1m1 0h1m3 0h2m1 0h6m1 0h7M8 21.5h4m4 0h1m1 0h1m1 0h1m3 0h5M0 22.5h7m1 0h2m1 0h2m1 0h1m2 0h4m1 0h1m1 0h2m1 0h1M0 23.5h1m5 0h1m1 0h4m1 0h4m1 0h3m3 0h2M0 24.5h1m1 0h3m1 0h1m3 0h1m1 0h1m2 0h4m1 0h5m1 0h1M0 25.5h1m1 0h3m1 0h1m1 0h1m2 0h3m1 0h2m2 0h3m1 0h3m2 0h1M0 26.5h1m1 0h3m1 0h1m1 0h1m2 0h4m1 0h4m3 0h1m2 0h1m1 0h1M0 27.5h1m5 0h1m2 0h2m2 0h1m1 0h1m4 0h1m1 0h2m1 0h1m1 0h1M0 28.5h7m1 0h6m2 0h1m1 0h3m2 0h1m3 0h1'

  /** 保存到相册用：白底 + 4 格留白的独立 SVG */
  export const qrFile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 37 37" width="740" height="740" shape-rendering="crispEdges"><path fill="#fff" d="M-4 -4h37v37h-37z"/><path stroke="#1a5b43" d="${d}"/></svg>`
</script>

<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'

  interface Props {
    class?: ClassValue
  }

  const { class: klass = '' }: Props = $props()
</script>

<svg class={klass} viewBox='0 0 29 29' shape-rendering='crispEdges' role='img' aria-label='登录二维码'>
  <path stroke='#1a5b43' {d} />
</svg>
