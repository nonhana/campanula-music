<!--
  网易云的封面缩略图：按显示尺寸取缩略图（地址加 ?param=宽y宽，按 2 倍屏取，原图不是正方形时网易云裁成正方形），默认懒加载。
  加载完从薄荷底上淡入，缓存里有的直接显示（image-reveal.svelte.ts）。
  圆角由调用方用 class 决定；图片加载不出来时淡入一个图标（默认音符，歌手头像传人像），不留破图，换了一张图再重新加载。
  fluid：宽度跟着容器（网格里的封面），size 只决定取多大的缩略图。
  flight：这张封面代表的页面地址（格子里是点开的那一页，页头是这一页）。换页时两头地址一样的封面从格子飞到页头、再飞回去（shell/page-transition.ts）
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
    flight?: string
  }

  const { url, size, fluid = false, class: klass, eager = false, fallback: Fallback = Music, flight }: Props = $props()
  const source = $derived(thumbnailUrl(url, size * 2))
  const reveal = createImageReveal(() => source)
</script>

<span
  class={['grid flex-none place-items-center overflow-hidden bg-primary-100 text-primary-950', fluid && 'aspect-square w-full', klass]}
  style:width={fluid ? undefined : `${size}px`}
  style:height={fluid ? undefined : `${size}px`}
  data-flight={flight}
>
  {#if reveal.status === 'broken'}
    <!-- 图标占显示宽度的 40%：fluid 时 size 只决定取多大的缩略图，不是显示的大小 -->
    <span class='grid w-2/5' in:fade={{ duration: DURATIONS.reveal }}>
      <Fallback class='h-auto w-full' aria-hidden='true' />
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
