<!--
  网易云的封面图缩略图：按 size 的 2 倍取（?param=宽y宽，原图不是正方形时网易云裁成正方形），默认懒加载。
  加载完从薄荷底淡入，缓存里有的直接显示（image-reveal.svelte.ts）；加载不出来或没给图（url 是 null）时淡入 fallback 图标，不留破图。
  placeholder 先铺同一张封面的小缩略图；下载里存了它的缩略图（#38）时先铺那个，断网就一直显示它。圆角由调用方的 class 决定。
  fluid：宽度跟着容器，size 只决定取多大。flight：这张图代表的页面地址，换页时两头一样的从格子飞到页头（shell/page-transition.ts）。
-->
<script lang='ts' module>
  import { thumbnailUrl } from '#lib/api/library.js'

  import { imageLoaded, preloadImage } from '../shared/image-reveal.svelte'

  export const coverSource = (url: string, size: number): string => thumbnailUrl(url, size * 2)

  /** 先在后台加载、解码好（参数和之后挂上的 Cover 一样），挂上时直接显示，不从薄荷底淡入 */
  export const preloadCover = (url: string, size: number): Promise<void> => preloadImage(coverSource(url, size))

  export const coverLoaded = (url: string, size: number): boolean => imageLoaded(coverSource(url, size))
</script>

<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import { Music } from '@lucide/svelte'
  import type { ClassValue } from 'svelte/elements'

  import { getAppView } from '../shared/app-context.svelte'
  import { createImageReveal } from '../shared/image-reveal.svelte'
  import { fade } from '../shared/motion'
  import { DURATIONS } from '../shared/motion-tokens'

  interface Props {
    url: string | null
    /** px；fluid 时是大概的最大宽度 */
    size: number
    fluid?: boolean
    class?: ClassValue
    eager?: boolean
    fallback?: LucideIcon
    flight?: string
    /** 小缩略图按多大取（Cover 的 size，比 size 小才有用）；不给就是薄荷底 */
    placeholder?: number
    /** false：只铺小图，不下载大图（换碟时转盘还没停下的封面） */
    load?: boolean
  }

  const { url, size, fluid = false, class: klass, eager = false, fallback: Fallback = Music, flight, placeholder, load = true }: Props = $props()
  const source = $derived(url === null
    ? ''
    : coverSource(url, size))
  const view = getAppView()
  const local = $derived(url === null
    ? null
    : view.state.downloads.coverOf(url))
  const small = $derived(local ?? (url !== null && placeholder !== undefined && placeholder < size
    ? coverSource(url, placeholder)
    : null))
  const reveal = createImageReveal(() => source)
</script>

<span
  class={['grid flex-none place-items-center overflow-hidden bg-primary-100 text-primary-950', fluid && 'aspect-square w-full', klass]}
  style:width={fluid
    ? undefined
    : `${size}px`}
  style:height={fluid
    ? undefined
    : `${size}px`}
  data-flight={flight}
>
  {#if url === null || (reveal.status === 'broken' && !local)}
    <!-- 图标占显示宽度的 40%：fluid 时 size 只决定取多大的缩略图，不是显示的大小 -->
    <span class='grid w-2/5' in:fade={{ duration: DURATIONS.reveal }}>
      <Fallback class='h-auto w-full' aria-hidden='true' />
    </span>
  {:else}
    {#if small && (reveal.status !== 'cached' || local)}
      <img src={small} alt='' class='col-start-1 row-start-1 size-full object-cover' decoding='async' draggable='false' />
    {/if}
    {#if load}
      {#key source}
        <img
          src={source}
          alt=''
          width={size}
          height={size}
          class={['col-start-1 row-start-1 size-full object-cover', (reveal.status === 'loading' || reveal.status === 'broken') && 'opacity-0', reveal.status === 'loaded' && 'transition-opacity duration-reveal']}
          loading={eager ? 'eager' : 'lazy'}
          decoding='async'
          draggable='false'
          {@attach reveal.image}
        />
      {/key}
    {/if}
  {/if}
</span>
