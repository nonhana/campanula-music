import type { Attachment } from 'svelte/attachments'
import { untrack } from 'svelte'
import { unseen } from './motion'

/** loading：还没好，透明；cached：加载过、缓存里有，直接显示；loaded：刚加载完，淡入；broken：加载不出来，换成图标 */
type ImageStatus = 'loading' | 'cached' | 'loaded' | 'broken'

/**
 * 这次打开 App 以来加载过的图片地址。再挂上时（虚拟列表滚回来、换回刚才那首）浏览器缓存里有，直接显示不再淡入。
 * 只看 img.complete 不够：懒加载的图挂上时在屏幕外，浏览器缓存里有也要等它进到附近才标成加载好
 */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- 只在挂上 img 的那一刻查，不驱动界面更新，不用做成响应式
const loaded = new Set<string>()

/** 正在后台加载的图，按地址：留着 img 的引用（加载完以前不被回收）和它加载完的那一刻；同一个地址只加载一次 */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- 只是留着引用，不驱动界面更新
const preloading = new Map<string, { img: HTMLImageElement, done: Promise<void> }>()

/**
 * 先在后台把图加载、解码好、记下来，之后挂上时直接显示（手机播放页的上一首、下一首封面：拖封面时一露出来就在）。
 * 只等 load 不够：没解码的图第一次画出来时可能先空一帧。返回加载完（或者加载不出来）的那一刻
 */
export function preloadImage(src: string): Promise<void> {
  if (loaded.has(src))
    return Promise.resolve()
  let pending = preloading.get(src)
  if (!pending) {
    const img = new Image()
    img.src = src
    const done = img.decode()
      .then(() => void loaded.add(src), () => {})
      .finally(() => preloading.delete(src))
    pending = { img, done }
    preloading.set(src, pending)
  }
  return pending.done
}

/** 这次打开 App 以来加载过这个地址 */
export function imageLoaded(src: string): boolean {
  return loaded.has(src)
}

export interface ImageReveal {
  readonly status: ImageStatus
  /** 挂到 img 上：`{#key source}<img src={source} {@attach reveal.image} />{/key}`，每张图一个元素 */
  image: Attachment<HTMLImageElement>
}

/**
 * 网络图片（封面、头像）从加载到显示（DESIGN.md Motion · 图片）：加载完从底色上淡入（240ms）；
 * 加载过的（虚拟列表滚回来、刚看过的）直接显示，不再淡一次；页面在后台时加载完的也直接显示，回来时不补一次淡入。
 * 加载不出来时调用方换成图标。按地址记：换了一张图就从头来，上一张没加载出来不连累下一张。source 是 img 的地址，要在组件初始化时调用
 */
export function createImageReveal(source: () => string): ImageReveal {
  let seen = $state<{ source: string, status: Exclude<ImageStatus, 'loading'> } | null>(null)
  const status = $derived(seen?.source === source()
? seen.status
: 'loading')

  return {
    get status() {
      return status
    },
    image(img) {
      const src = untrack(source)
      // 挂上时已经加载好的也记下：同一个地址再挂上时直接显示、不从透明淡入（例如封面从格子飞到页头，页头那张大封面）
      if (img.complete && img.naturalWidth > 0)
        loaded.add(src)
      if (loaded.has(src))
        seen = { source: src, status: 'cached' }
      const onload = () => {
        loaded.add(src)
        if (seen?.source !== src) {
          seen = {
source: src,
status: unseen()
? 'cached'
: 'loaded',
}
}
      }
      // 缓存里的也可能已经被浏览器清掉、重新取时失败
      const onerror = () => (seen = { source: src, status: 'broken' })
      img.addEventListener('load', onload)
      img.addEventListener('error', onerror)
      return () => {
        img.removeEventListener('load', onload)
        img.removeEventListener('error', onerror)
      }
    },
  }
}
