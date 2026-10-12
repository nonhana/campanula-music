<!--
  网易云的封面缩略图：按显示尺寸取缩略图（地址加 ?param=宽y宽，按 2 倍屏取），默认懒加载。
  圆角由调用方用 class 决定；图片加载不出来时显示一个音符图标，不留破图。
-->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'
  import { Music } from '@lucide/svelte'

  interface Props {
    url: string
    /** 显示尺寸（px） */
    size: number
    class?: ClassValue
    /** 首屏的大封面：不懒加载 */
    eager?: boolean
  }

  const { url, size, class: klass, eager = false }: Props = $props()
  let broken = $state(false)
  const source = $derived(`${url.replace(/^http:/, 'https:')}?param=${size * 2}y${size * 2}`)
</script>

<span class={['grid flex-none place-items-center overflow-hidden bg-primary-100 text-primary-950', klass]} style:width='{size}px' style:height='{size}px'>
  {#if broken}
    <Music size={Math.round(size * 0.4)} aria-hidden='true' />
  {:else}
    <img
      src={source}
      alt=''
      width={size}
      height={size}
      class='size-full object-cover'
      loading={eager ? 'eager' : 'lazy'}
      decoding='async'
      draggable='false'
      onerror={() => (broken = true)}
    />
  {/if}
</span>
