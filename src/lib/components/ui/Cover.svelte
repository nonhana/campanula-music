<!--
  网易云的封面图缩略图：按显示尺寸取缩略图（地址加 ?param=宽y宽，按 2 倍屏取，原图不是正方形时网易云裁成正方形），默认懒加载。
  加载完从薄荷底上淡入，缓存里有的直接显示（image-reveal.svelte.ts）。
  placeholder：大图加载好以前先铺同一张封面图的小缩略图（例如歌曲行里那张，多半已经加载过），大图加载完从小图上淡入；
  load 为 false 时只铺小图、先不去下载大图（换碟时转盘还没停下的封面图）。
  圆角由调用方用 class 决定；图片加载不出来、或者网易云没给图（url 是 null，例如有的歌手没有头像）时淡入一个图标（默认音符，歌手头像传人像），
  不留破图，换了一张图再重新加载。
  这张封面图有下载存着的缩略图（#38）时：大图加载好以前先铺它（它在本机，马上就有）；断网时大图加载不出来，就一直显示它，不换成图标。
  fluid：宽度跟着容器（网格里的封面图），size 只决定取多大的缩略图。
  flight：这张封面图代表的页面地址（格子里是点开的那一页，页头是这一页）。换页时两头地址一样的封面图从格子飞到页头、再飞回去（shell/page-transition.ts）
-->
<script lang='ts' module>
  import { thumbnailUrl } from '#lib/api/library.js'

  import { imageLoaded, preloadImage } from '../shared/image-reveal.svelte'

  /** 按显示尺寸 size 取的缩略图地址：按 2 倍屏取 */
  export const coverSource = (url: string, size: number): string => thumbnailUrl(url, size * 2)

  /** 先在后台把这张封面图加载、解码好（url、size 和之后挂上的 Cover 一样），挂上时直接显示、不从薄荷底上淡入。返回加载完（或加载不出来）的那一刻 */
  export const preloadCover = (url: string, size: number): Promise<void> => preloadImage(coverSource(url, size))

  /** 这张封面图这次打开 App 以来加载过：挂上时直接显示 */
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
    /** 网易云的原图地址；没有图时是 null，直接显示图标 */
    url: string | null
    /** 显示尺寸（px）；fluid 时是大概的最大宽度 */
    size: number
    fluid?: boolean
    class?: ClassValue
    /** 首屏的大封面图：不懒加载 */
    eager?: boolean
    /** 加载不出来时的图标 */
    fallback?: LucideIcon
    flight?: string
    /** 大图加载好以前先铺的小缩略图按多大取（Cover 的 size，比 size 小才有用）；不给就是薄荷底 */
    placeholder?: number
    /** false：只铺小图，先不去下载大图 */
    load?: boolean
  }

  const { url, size, fluid = false, class: klass, eager = false, fallback: Fallback = Music, flight, placeholder, load = true }: Props = $props()
  const source = $derived(url === null
    ? ''
    : coverSource(url, size))
  const view = getAppView()
  /** 下载存着的这张封面图的缩略图（blob: 地址）；没有是 null */
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
