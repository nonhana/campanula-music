import { tick, untrack } from 'svelte'
import type { Attachment } from 'svelte/attachments'

import { flightArc, reducedMotion, REVEAL_GROUP, unseen } from '../shared/motion'
import { cssEasing, DURATIONS, FLOAT_DISTANCE, OPENING } from '../shared/motion-tokens'

// 打开 App 的 logo 归位（DESIGN.md Motion · 打开 App）：打开中（AppOpening）换成别的一屏时，正中那朵花沿浅弧线飞到新一屏左上角的 Brand、
// 缩成它的大小，落地前字样从花后面飘出来；内容区一块块从花的落点那边飘出来，近的先到、远的后到，像花落下时漾开的一圈，
// 每块从薄雾里清晰起来。顶栏、侧栏只跟着整屏淡入（+layout.svelte），先搭好台子。
// 飞的是盖在最上面的一份拷贝，Web Animations 走完、每帧不读排版（和 player/cover-flight 一样），两头的花飞时都藏着。
// 新的一屏没有 Brand（手机直接打开二级页，顶上是返回栏）时不飞：花跟着旧的一屏淡出、往上飘走，内容从屏幕正中它消失的地方漾开。
// 减少动态效果、页面在后台时都不做，只剩整屏淡入淡出。

/** 盖在顶栏（40）上面；刚打开时还没有播放提示、播放页（50） */
const PLANE_LAYER = '45'

let plane: { element: SVGSVGElement, animation: Animation, landing: SVGSVGElement } | null = null

/** 写在 +layout.svelte 换屏的那一层上：每一屏挂上时，看旧的一屏是不是打开中 */
export const arrival: Attachment<HTMLElement> = (screen) => {
  untrack(() => void arrive(screen))
}

const arrive = async (screen: HTMLElement): Promise<void> => {
  // 上一次还没飞完又换了一屏（刚进曲库就登录失效）：飞的那朵直接拿掉
  ground()
  const departure = document.querySelector<SVGSVGElement>('[data-opening] svg')
  // 没有打开中，或者新的一屏自己就是（出错后重试）
  if (!departure || screen.contains(departure) || reducedMotion() || unseen())
    return
  // 打开中只送走一次：它还在淡出时又换了一屏（刚进曲库就登录失效），那一屏照普通换屏来，不再飞一朵已经藏起来的花
  departure.closest('[data-opening]')!.removeAttribute('data-opening')
  // 等新的一屏整个挂好：旧的一屏 out:fadeAway 已经让出了高度，新的一屏从窗口顶上开始
  await tick()
  const brand = screen.querySelector('[data-brand]')
  const landing = brand?.querySelector('svg')
  const end = landing?.getBoundingClientRect()
  const start = departure.getBoundingClientRect()
  const main = screen.querySelector('main')
  if (main)
    ripple(main, centerOf(end ?? start), brand)
  if (!brand || !landing || !end) {
    departure.animate(
      [
        { translate: '0 0' },
        { translate: `0 ${-FLOAT_DISTANCE.out}px` },
      ],
      {
        duration: DURATIONS['panel-out'],
        easing: cssEasing('in-soft'),
        fill: 'forwards',
      },
    )
    return
  }
  const element = departure.cloneNode(true) as SVGSVGElement
  element.setAttribute('width', `${end.width}`)
  element.setAttribute('height', `${end.height}`)
  Object.assign(element.style, {
    position: 'fixed',
    left: `${end.x}px`,
    top: `${end.y}px`,
    transformOrigin: '0 0',
    zIndex: PLANE_LAYER,
    pointerEvents: 'none',
  })
  document.body.append(element)
  departure.style.visibility = 'hidden'
  landing.style.visibility = 'hidden'
  const animation = element.animate(flightArc(start, end), {
    duration: DURATIONS.focal,
    easing: cssEasing('out-soft'),
    fill: 'forwards',
  })
  plane = { element, animation, landing }
  // 花差不多停稳时，字样从花后面往右飘出来，和花同时落定
  brand.querySelector('[data-brand-name]')!.animate(
    [
      { opacity: 0, translate: `${-FLOAT_DISTANCE.in}px 0`, filter: `blur(${OPENING.blur}px)` },
      { opacity: 1, translate: '0 0', filter: 'blur(0)' },
    ],
    {
      duration: DURATIONS.state,
      delay: DURATIONS.focal - DURATIONS.state,
      easing: cssEasing('out-soft'),
      fill: 'backwards',
    },
  )
  // 被拿掉时（又换了一屏）finished 会失败
  if (await animation.finished.then(() => true, () => false) && plane?.element === element)
    ground()
}

interface Point { x: number, y: number }

const centerOf = (rect: DOMRect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })

/**
 * 内容区一块块飘进来：离 origin 越远越晚（最远的晚 spread），每块从 origin 那一边漂过来（The Float Rule：来有来处），从薄雾里清晰起来。
 * 窗口外的不动；结束后不留样式（fill: backwards），块自己的透明度、位移照旧
 */
const ripple = (main: Element, origin: Point, brand: Element | null): void => {
  const pieces = piecesOf(main, brand).map((element) => {
    const rect = element.getBoundingClientRect()
    const center = centerOf(rect)
    const dx = center.x - origin.x
    const dy = center.y - origin.y
    const length = Math.hypot(dx, dy) || 1
    // 远近按块上离 origin 最近的那一点算：整行宽的标题行从它左头算，不因为右头远就晚到
    const nearX = Math.min(Math.max(origin.x, rect.left), rect.right)
    const nearY = Math.min(Math.max(origin.y, rect.top), rect.bottom)
    return {
      element,
      reach: Math.hypot(nearX - origin.x, nearY - origin.y),
      x: dx / length,
      y: dy / length,
    }
  })
  const nearest = Math.min(...pieces.map(piece => piece.reach))
  const farthest = Math.max(...pieces.map(piece => piece.reach))
  for (const { element, reach, x, y } of pieces) {
    element.animate(
      [
        {
          offset: 0,
          opacity: 0,
          translate: `${-x * FLOAT_DISTANCE.in}px ${-y * FLOAT_DISTANCE.in}px`,
          filter: `blur(${OPENING.blur}px)`,
        },
      ],
      {
        duration: DURATIONS.panel,
        delay: OPENING.delay + (farthest > nearest
          ? (reach - nearest) / (farthest - nearest)
          : 0) * OPENING.spread,
        easing: cssEasing('out-soft'),
        fill: 'backwards',
      },
    )
  }
}

/**
 * 内容区拆成一块块：一组（data-reveal-group：歌曲行、格子、架子）里的每一项各是一块，组外不含组的整块是一块；
 * 落点的 Brand 自己飞，不算（缺加密密钥的说明页它就在 main 里）。display: contents 的往里拆，整块在窗口外的不要
 */
const piecesOf = (node: Element, brand: Element | null): Element[] => [...node.children].flatMap((child) => {
  if (child === brand)
    return []
  const rect = child.getBoundingClientRect()
  const empty = rect.width === 0 || rect.height === 0
  if (!empty && (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth))
    return []
  return empty || child.matches(REVEAL_GROUP) || child.querySelector(REVEAL_GROUP) || (brand && child.contains(brand))
    ? piecesOf(child, brand)
    : [child]
})

/** 飞的那朵拿掉，落点的花露出来 */
const ground = (): void => {
  if (!plane)
    return
  plane.animation.cancel()
  plane.element.remove()
  plane.landing.style.visibility = ''
  plane = null
}
