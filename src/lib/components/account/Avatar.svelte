<!--
  网易云账号的头像：正圆，按显示尺寸取网易云的缩略图（地址加 ?param=宽y宽，按 2 倍屏取）。
  加载完从薄荷底上淡入，缓存里有的直接显示（image-reveal.svelte.ts）；加载不出来时淡入一个人形图标，不留破图。
-->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'
  import { User } from '@lucide/svelte'
  import { thumbnailUrl } from '#lib/api/library.js'
  import { createImageReveal } from '../shared/image-reveal.svelte'
  import { fade } from '../shared/motion'
  import { DURATIONS } from '../shared/motion-tokens'

  interface Props {
    url: string
    /** 显示尺寸（px） */
    size: number
    class?: ClassValue
  }

  const { url, size, class: klass }: Props = $props()
  const source = $derived(thumbnailUrl(url, size * 2))
  const reveal = createImageReveal(() => source)
</script>

<span class={['grid flex-none place-items-center overflow-hidden rounded-full bg-primary-100 text-primary-950', klass]} style:width='{size}px' style:height='{size}px'>
  {#if reveal.status === 'broken'}
    <span class='grid' in:fade={{ duration: DURATIONS.reveal }}>
      <User size={Math.round(size * 0.55)} aria-hidden='true' />
    </span>
  {:else}
    {#key source}
      <img
        src={source}
        alt=''
        width={size}
        height={size}
        class={['size-full object-cover', reveal.status === 'loading' && 'opacity-0', reveal.status === 'loaded' && 'transition-opacity duration-reveal']}
        {@attach reveal.image}
      />
    {/key}
  {/if}
</span>
