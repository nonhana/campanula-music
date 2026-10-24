import type { RouteId } from '$app/types'
import type { Toward } from '../shared/motion'
import { onNavigate } from '$app/navigation'
import { onMount } from 'svelte'
import { reducedMotion } from '../shared/motion'
import { LANDING_WAIT } from '../shared/motion-tokens'

/** 换页往哪边走：内容往 up / down / left / right 漂（同 motion.ts 的 Toward），fade 只淡入淡出 */
type PageTurn = Toward | 'fade'

/**
 * 换页的方向（DESIGN.md Navigation · 页面切换），交给 uno.config.ts 的页面过渡：
 * - 同一层：曲库标签之间（tabs，从左到右）按左右顺序横着走，新页从所选标签那一侧进来；
 *   同一种页面之间（桌面歌单页左栏换歌单）只淡入淡出；
 * - 后退、前进（delta）：返回往下沉，前进往上浮；
 * - 点进去的：回到曲库是返回，其余（曲库 → 歌单、专辑、歌手、设置，专辑 → 歌手）是进入下一层
 */
function pageTurn(from: RouteId, to: RouteId, delta: number | undefined, tabs: readonly RouteId[]): PageTurn {
  const fromTab = tabs.indexOf(from)
  const toTab = tabs.indexOf(to)
  if (fromTab >= 0 && toTab >= 0)
    return toTab > fromTab ? 'left' : 'right'
  if (from === to)
    return 'fade'
  if (delta !== undefined)
    return delta < 0 ? 'down' : 'up'
  return toTab >= 0 ? 'down' : 'up'
}

/** 换页时飞的那张封面图的名字（uno.config.ts）。同一时刻文档里只有一个元素叫这个名字，只有一张封面图在飞（The Cover Leads Rule） */
const COVER = 'cover'

/** 封面图已经加载好：飞到位时不是空的薄荷底（The Cover Leads Rule） */
function loaded(img: HTMLImageElement | null): img is HTMLImageElement {
  return img !== null && img.complete && img.naturalWidth > 0
}

/** 降落那一头的图：缓存里的等它标成加载好（最多 LANDING_WAIT），再等它解码好 */
async function landingReady(img: HTMLImageElement): Promise<boolean> {
  if (!img.complete) {
    await new Promise<void>((done) => {
      const timer = setTimeout(done, LANDING_WAIT)
      const finish = () => {
        clearTimeout(timer)
        done()
      }
      img.addEventListener('load', finish, { once: true })
      img.addEventListener('error', finish, { once: true })
    })
  }
  return loaded(img) && img.decode().then(() => true, () => false)
}

/**
 * 封面图正中那一点露在内容区里：在窗口里、在顶栏下面（两种骨架都把顶栏的高度写在 scroll-padding-top 上），
 * 没被架子这类滚动容器裁掉。按位置算：拍新的一帧之前，浏览器的点按测试只认 <html>
 */
function exposed(cover: HTMLElement): boolean {
  const { left, top, width, height } = cover.getBoundingClientRect()
  const x = left + width / 2
  const y = top + height / 2
  const topBar = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
  if (x < 0 || x > innerWidth || y < topBar || y > innerHeight)
    return false
  for (let box = cover.parentElement; box && box !== document.body; box = box.parentElement) {
    if (getComputedStyle(box).overflow === 'visible')
      continue
    const clip = box.getBoundingClientRect()
    if (x < clip.left || x > clip.right || y < clip.top || y > clip.bottom)
      return false
  }
  return true
}

/**
 * 页面里代表 page 这一页的封面图（Cover 的 flight）：格子里是点开它的那一格，它自己的页头是大封面图。
 * 桌面歌单页里这一页有两张（页头、左栏当前这一项），页头在 DOM 里排在前面：起飞、降落都先找到页头，页头滚走了才轮到左栏那张
 */
function coversOf(page: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[data-flight="${CSS.escape(page)}"]`)]
}

/**
 * 换页用浏览器的 View Transitions（ADR-0011），要在组件初始化时调用。tabs 是曲库标签的地址，从左到右。
 * - 浏览器先拍下旧页面，等 SvelteKit 渲染好新页面、返回时恢复好滚动位置（snapshot.ts 同步恢复），再拍新的一帧；
 * - 从格子点开歌单、专辑、歌手（桌面歌单页的左栏也是格子）：被点的那张封面图飞到页头（两头同名），回到格子所在的那一页时飞回去。
 *   直接打开、从别处进来的详情页，返回时只整页飘入；
 * - 过渡中又换了页：上一个立刻结束，不排队；
 * - Android 的返回手势自己放了“预览上一页”的动画（hasUAVisualTransition）：不再叠一层，直接换；
 * - 不支持的浏览器直接换页。播放页的开关是浅路由，不经过这里
 */
export function pageTransitions(tabs: readonly RouteId[]): void {
  let running: ViewTransition | null = null
  /** 最近一次点按到的链接：点的是格子，它的封面图飞到新页的页头 */
  let pressed: HTMLAnchorElement | null = null
  /**
   * 从格子点进去的页面（地址 → 点进它的格子所在那些页的地址）：从这一页回到其中一页时飞回格子（DESIGN.md Navigation · 页面切换）。
   * 一层层点进去（歌手格子 → 歌手页里的专辑）也一层层飞回来；同一页在历史里出现几次（左栏换过去又换回来），每次的来处都记着，
   * 后退到哪一次都飞。直接打开、从别处进来的不在这里，返回时只整页飘入
   */
  const grids = new Map<string, Set<string>>()
  /** 现在叫 COVER 的封面图；换页、过渡结束时去掉名字，免得下一次换页时两个元素同名 */
  let named: HTMLElement | null = null

  function name(cover: HTMLElement | null) {
    if (named)
      named.style.viewTransitionName = ''
    named = cover
    if (cover)
      cover.style.viewTransitionName = COVER
  }

  /**
   * 起飞：点的是格子（link 是点到的链接），飞的是被点的那一格；回到格子所在的那一页，飞的是页头的大封面图。
   * 减少动态效果时不飞（只剩交叉淡化）。返回两头共用的页面地址
   */
  function takeOff(link: HTMLAnchorElement | null, from: URL, to: URL): string | null {
    const tile = link?.querySelector<HTMLElement>(`[data-flight="${CSS.escape(to.pathname)}"]`) ?? null
    if (tile)
      grids.set(to.href, (grids.get(to.href) ?? new Set()).add(from.href))
    const page = tile ? to.pathname : grids.get(from.href)?.has(to.href) ? from.pathname : null
    const cover = tile ?? (page === null ? null : coversOf(page).find(exposed))
    if (page === null || reducedMotion() || !cover || !exposed(cover) || !loaded(cover.querySelector('img')))
      return null
    name(cover)
    return page
  }

  /**
   * 降落：新页面画好、滚动位置恢复好以后，找到代表同一页、露在屏幕里的那一张，等它的图加载好、解码好，名字从起飞的那张交给它。
   * 找不到（页头还是骨架、格子滚出了屏幕、图没到）就只有起飞那一头，它跟着旧页一起飘出（uno.config.ts）。
   * current：这次过渡还没被下一次换页顶掉；顶掉了名字归下一次管
   */
  async function land(page: string, current: () => boolean) {
    const cover = coversOf(page).find(exposed)
    const img = cover?.querySelector('img')
    if (cover && img && await landingReady(img) && current())
      name(cover)
  }

  onNavigate((navigation) => {
    if (navigation.shallow && navigation.type === 'goto')
      return

    running?.skipTransition()
    running = null
    name(null)
    const link = navigation.type === 'link' ? pressed : null
    pressed = null
    const { from, to } = navigation
    if (!document.startViewTransition || !from?.route.id || !to?.route.id || from.url.href === to.url.href)
      return
    if (navigation.type === 'popstate' && navigation.event.hasUAVisualTransition)
      return

    const delta = navigation.type === 'popstate' ? navigation.delta : undefined
    const turn = pageTurn(from.route.id, to.route.id, delta, tabs)
    const flight = takeOff(link, from.url, to.url)

    return new Promise<void>((captured) => {
      const transition = document.startViewTransition({
        types: [turn],
        update: async () => {
          captured()
          // 被下一次换页打断时 complete 会失败：这一页不用等了，下一次换页会把这个过渡结束掉
          const done = await navigation.complete.then(() => true, () => false)
          if (flight && done)
            await land(flight, () => running === transition)
        },
      })
      running = transition
      // 被跳过（又换了一页、页面在后台）时 ready 会失败，是预期的
      transition.ready.catch(() => {})
      void transition.finished.then(() => {
        if (running !== transition)
          return
        running = null
        name(null)
      })
    })
  })

  // 过渡中浏览器把所有点按都交给 <html>，链接、按钮都点不到。按下时就结束过渡，
  // 松开后的 click 交给手指下面真正的元素：快速连点、过渡中点别的页面都照常生效（DESIGN.md Motion · 随时可打断）
  onMount(() => {
    let interrupted = false
    const press = () => {
      interrupted = running !== null
      running?.skipTransition()
    }
    const click = (event: MouseEvent) => {
      if (event.target instanceof Element)
        pressed = event.target.closest('a')
      if (!interrupted || event.target !== document.documentElement)
        return
      interrupted = false
      // 同一次点按（带着 ⌘ / Ctrl / Shift）原样交给它：链接、按钮都按平常的规矩处理，svg 图标上点的也会冒泡到按钮
      document.elementFromPoint(event.clientX, event.clientY)?.dispatchEvent(new MouseEvent('click', event))
    }
    document.addEventListener('pointerdown', press, true)
    document.addEventListener('click', click, true)
    return () => {
      document.removeEventListener('pointerdown', press, true)
      document.removeEventListener('click', click, true)
    }
  })
}
