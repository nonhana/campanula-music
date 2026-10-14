<!--
  网易云的封面缩略图：按显示尺寸取缩略图（地址加 ?param=宽y宽，按 2 倍屏取，原图不是正方形时网易云裁成正方形），默认懒加载。
  加载完从薄荷底上淡入，缓存里有的直接显示（image-reveal.svelte.ts）。
  圆角由调用方用 class 决定；图片加载不出来时淡入一个图标（默认音符，歌手头像传人像），不留破图，换了一张图再重新加载。
  fluid：宽度跟着容器（网格里的封面），size 只决定取多大的缩略图
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { ClassValue } from 'svelte/elements'
  import { Music } from '@lucide/svelte'
  import { createImageReveal } from '../image-reveal.svelte'
  import { fade } from '../motion'
  import { DURATIONS } from '../motion-tokens'
  import { thumbnailUrl } from './view'

  interface Props {
    url: string
    /** 显示尺寸（px）；fluid 时是大概的最大宽度 */
    size: number
    fluid?: boolean
    class?: ClassValue
    /** 首屏的大封面：不懒加载 */
    eager?: boolean
    /** 加载不出来时的图标 */
    fallback?: LucideIcon
  }

  const { url, size, fluid = false, class: klass, eager = false, fallback: Fallback = Music }: Props = $props()
  const source = $derived(thumbnailUrl(url, size * 2))
  const reveal = createImageReveal(() => source)
</script>

<span
  class={['grid flex-none place-items-center overflow-hidden bg-primary-100 text-primary-950', fluid && 'aspect-square w-full', klass]}
  style:width={fluid ? undefined : `${size}px`}
  style:height={fluid ? undefined : `${size}px`}
>
  {#if reveal.status === 'broken'}
    <span class='grid' in:fade={{ duration: DURATIONS.reveal }}>
      <Fallback size={Math.round(size * 0.4)} aria-hidden='true' />
    </span>
  {:else}
    {#key source}
      <img
        src={source}
        alt=''
        width={size}
        height={size}
        class={['size-full object-cover', reveal.status === 'loading' && 'opacity-0', reveal.status === 'loaded' && 'transition-opacity duration-reveal']}
        loading={eager ? 'eager' : 'lazy'}
        decoding='async'
        draggable='false'
        {@attach reveal.image}
      />
    {/key}
  {/if}
</span>
