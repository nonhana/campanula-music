<!--
  网易云账号的头像：正圆，按显示尺寸取网易云的缩略图（地址加 ?param=宽y宽，按 2 倍屏取）。
  图片加载不出来时显示一个人形图标，不留破图。
-->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'
  import { User } from '@lucide/svelte'

  interface Props {
    url: string
    /** 显示尺寸（px） */
    size: number
    class?: ClassValue
  }

  const { url, size, class: klass }: Props = $props()
  let broken = $state(false)
  const source = $derived(`${url.replace(/^http:/, 'https:')}?param=${size * 2}y${size * 2}`)
</script>

<span class={['grid flex-none place-items-center overflow-hidden rounded-full bg-primary-100 text-primary-950', klass]} style:width='{size}px' style:height='{size}px'>
  {#if broken}
    <User size={Math.round(size * 0.55)} aria-hidden='true' />
  {:else}
    <img src={source} alt='' width={size} height={size} class='size-full object-cover' onerror={() => (broken = true)} />
  {/if}
</span>
