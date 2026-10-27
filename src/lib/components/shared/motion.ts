import { flushSync } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import type { TransitionConfig } from 'svelte/transition'

import { AXES, cssEasing, DURATIONS, EASINGS, FLIGHT_ARC, FLOAT_DISTANCE, REDUCED_FADE_MS, STAGGER } from './motion-tokens'

// 组件里的 JS 动效（Svelte 过渡、Tween、换碟、程序滚动）从这里取时长和曲线，减少动态效果也在这里统一处理（DESIGN.md Motion）：
// 位移、缩放、平滑滚动去掉，淡入淡出和颜色变化留着、最多 150ms，组件里不再自己判断；CSS 那一半在 uno.config.ts。
// 看不见时不动：页面在后台（锁屏、切走）时长都是 0，状态直接到位；后台不画帧，这时开始的动画会拖到回前台才补放。

export const reducedMotion = (): boolean => prefersReducedMotion.current

/** 页面在后台（锁屏、切走）：回来时不补放 */
export const unseen = (): boolean => document.visibilityState === 'hidden'

let settling = false

/** 状态一下子到位、不播过渡：返回一页时恢复的筛选、搜索词（snapshot.ts）。change 当场画好，换页过渡拍新帧时已是恢复好的样子；不能在 effect 里调（flushSync） */
export const atOnce = (change: () => void): void => {
  settling = true
  try {
    flushSync(change)
  }
  finally {
    settling = false
  }
}

const instant = (): boolean => settling || unseen()

/** 减少动态效果时最多 150ms，页面在后台时是 0 */
export const fadeMs = (ms: number): number => {
  if (instant())
    return 0
  return reducedMotion()
    ? Math.min(ms, REDUCED_FADE_MS)
    : ms
}

/** 减少动态效果、页面在后台时是 0 */
export const moveMs = (ms: number): number => reducedMotion() || instant()
  ? 0
  : ms

/** 翻页键、歌词跟着当前行走：减少动态效果时直接跳过去 */
export const scrollBehavior = (): ScrollBehavior => reducedMotion()
  ? 'auto'
  : 'smooth'

/** 一次性布局变化（DESIGN.md Motion · 不动布局的例外）：高度从 from 到 to、横着飘的不裁；没有要动时返回 null。连着变时先量此刻高度、再 cancel 上一次 */
export const animateHeight = (element: HTMLElement, from: number, to: number, duration: number): Animation | null => {
  const ms = moveMs(duration)
  if (ms === 0 || Math.abs(to - from) < 1)
    return null
  return element.animate(
    [
      { height: `${from}px`, overflowY: 'clip' },
      { height: `${to}px`, overflowY: 'clip' },
    ],
    {
      duration: ms,
      easing: cssEasing('out-soft'),
    },
  )
}

const FLIGHT_STEPS = 12

/**
 * 飞行（点歌时封面飞进播放条、打开 App 时 logo 归位）的 Web Animations 关键帧：从 from 沿往上鼓的浅弧线飞到 to（二次贝塞尔，分 FLIGHT_STEPS 段），
 * 边飞边变成 to 的大小。飞的元素摆在 to 上、缩放原点在左上角
 */
export const flightArc = (from: DOMRect, to: DOMRect): Keyframe[] => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  // 控制点在连线正中往外推，推向和连线垂直、朝上的那一边（竖直往下飞时往右）
  const bend = FLIGHT_ARC * length * (dx < 0
    ? -1
    : 1)
  const cx = from.x + dx / 2 + (dy / length) * bend
  const cy = from.y + dy / 2 - (dx / length) * bend
  return Array.from({ length: FLIGHT_STEPS + 1 }, (_, i) => {
    const t = i / FLIGHT_STEPS
    const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t ** 2 * to.x
    const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t ** 2 * to.y
    const scale = (from.width + (to.width - from.width) * t) / to.width
    return { transform: `translate(${x - to.x}px, ${y - to.y}px) scale(${scale})` }
  })
}

/** CSS 的 cubic-bezier 换成 JS 缓动函数，和 CSS 同一条曲线（WebKit UnitBezier 的解法） */
const cubicBezier = ([x1, y1, x2, y2]: readonly [number, number, number, number]): (t: number) => number => {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const x = (s: number) => ((ax * s + bx) * s + cx) * s
  const y = (s: number) => ((ay * s + by) * s + cy) * s
  const slope = (s: number) => (3 * ax * s + 2 * bx) * s + cx
  /** 先用牛顿法，斜率太平时退回二分 */
  const solve = (t: number): number => {
    let s = t
    for (let i = 0; i < 8; i += 1) {
      const error = x(s) - t
      if (Math.abs(error) < 1e-6)
        return s
      const d = slope(s)
      if (Math.abs(d) < 1e-6)
        break
      s -= error / d
    }
    let low = 0
    let high = 1
    s = t
    while (high - low > 1e-6) {
      if (x(s) < t)
        low = s
      else
        high = s
      s = (low + high) / 2
    }
    return s
  }
  return t => (t <= 0
    ? 0
    : t >= 1
      ? 1
      : y(solve(t)))
}

export const easeOutSoft = cubicBezier(EASINGS['out-soft'])
const easeInSoft = cubicBezier(EASINGS['in-soft'])

/** in: / out: 各是 in / out，transition: 是 both（见 twoWay） */
export interface TransitionOptions {
  direction?: 'in' | 'out' | 'both'
}

export type MotionConfig = TransitionConfig | ((options?: { direction?: 'in' | 'out' }) => TransitionConfig)

/**
 * transition: 写法（一个指令管进出）：进出各按各的规矩，会被连按、来回切的（菜单、提示、换内容）都用它。中途掉头时从此刻的进度接着走
 * （DESIGN.md Motion · 随时可打断）：往哪漂、漂多远、缩放沿用开始时那个方向，只换时长和曲线，所以沿原路回去；in/out 分开写会先跳回起点。
 * delay 只给刚进来的那一头：新内容等一下再进，旧的马上走，掉头回来的不等。atOnce() 里、页面在后台时直接到位。
 */
const twoWay = <P>(motion: (node: Element, params: P, options: TransitionOptions) => TransitionConfig, node: Element, params: P, options: TransitionOptions): MotionConfig => {
  if (options.direction !== 'both')
    return motion(node, params, options)
  if (instant())
    return {}
  /** 这一趟的样子：第一次（刚开始进来或出去）定下，之后掉头都沿用 */
  let path: TransitionConfig['css']
  return ({ direction } = {}) => {
    const config = motion(node, params, { direction })
    const turning = path !== undefined
    path ??= config.css
    return {
      ...config,
      css: path,
      delay: direction === 'out' || turning
        ? 0
        : config.delay,
    }
  }
}

const easingOf = (options: TransitionOptions): (t: number) => number => options.direction === 'out'
  ? easeInSoft
  : easeOutSoft

interface FadeParams {
  /** 两头都按这个时长；不写时淡入 200ms、淡出 120ms */
  duration?: number
  delay?: number
}

/** 同一块地方换内容时交叉淡化（新旧叠在同一个网格格子里）、图标淡入、徽标数字冒出来；不写 duration 时淡入 200ms、淡出 120ms */
export const fade = (node: Element, params: FadeParams = {}, options: TransitionOptions = {}): MotionConfig => twoWay(fadeOnce, node, params, options)

const fadeOnce = (_node: Element, { duration, delay = 0 }: FadeParams, options: TransitionOptions): TransitionConfig => {
  const out = options.direction === 'out'
  return {
    delay: instant()
      ? 0
      : delay,
    duration: fadeMs(duration ?? (out ? DURATIONS['state-out'] : DURATIONS.state)),
    easing: easingOf(options),
    css: t => `opacity: ${t}`,
  }
}

/** 一块地方整个换成别的（歌单筛选，DESIGN.md Overlays · 筛选）：旧先淡出（120ms），淡完新的再淡入（240ms），里面的东西不各自挪位 */
export const fadeThrough = (node: Element, _params?: undefined, options: TransitionOptions = {}): MotionConfig => twoWay(fadeThroughOnce, node, undefined, options)

const fadeThroughOnce = (node: Element, _params: undefined, options: TransitionOptions): TransitionConfig => options.direction === 'out'
  ? fadeOnce(node, {}, options)
  : fadeOnce(node, {
      duration: DURATIONS.reveal,
      delay: fadeMs(DURATIONS['state-out']),
    }, options)

/**
 * 骨架淡出（out:fadeAway，DESIGN.md Motion · 依次飘入）：淡出时不占高度（下边距减掉自身高度），后面的内容马上从骨架位置开始；
 * 骨架还留在排版里，点按穿过它落到内容上。一块骨架只在最外层写一次：里外两层会各减一次高度、把内容往上拉（#32），开发时套两层会报错。
 */
export const fadeAway = (node: HTMLElement, { duration = DURATIONS['state-out'] }: { duration?: number } = {}, options: TransitionOptions = {}): TransitionConfig => {
  if (import.meta.env.DEV)
    checkSingleFadeAway(node)
  node.style.marginBottom = `calc(${getComputedStyle(node).marginBottom} - ${node.offsetHeight}px)`
  node.style.pointerEvents = 'none'
  return {
    duration: fadeMs(duration),
    easing: easingOf(options),
    css: t => `opacity: ${t}`,
  }
}

/** 里外又有一层在淡出就报错（两层都让出高度，后面的内容会被往上拉） */
const checkSingleFadeAway = (node: HTMLElement): void => {
  const nested = node.parentElement?.closest('[data-fading-away]') ?? node.querySelector('[data-fading-away]')
  if (nested)
    console.error('out:fadeAway 套在另一个 out:fadeAway 里：只在骨架的最外层写一次（motion.ts fadeAway 的注释）', node)
  node.dataset.fadingAway = ''
}

/** node 里标了 data-reveal-group 的元素（虚拟列表、网格），没有就是 node 自己；打开 App 时也按它把内容区拆成一块块（boot/opening.ts） */
export const REVEAL_GROUP = '[data-reveal-group]'

/**
 * 骨架换成内容时依次飘入（in:reveal，DESIGN.md Motion），放在骨架所在 {#if} 的另一分支；页面打开时内容已经在就不播，换页整页一起飘。
 * 一组直接子元素里前 6 个依次晚 30ms 从下面飘上来，其余和第 6 个一起（uno.config.ts 的 .revealing）；.revealing 只挂一小会儿。
 */
export const reveal = (node: HTMLElement): TransitionConfig => {
  const found = [
    ...node.querySelectorAll(REVEAL_GROUP),
  ]
  const groups = found.length > 0
    ? found
    : [node]
  for (const group of groups)
    group.classList.add('revealing')
  node.addEventListener('introend', () => {
    for (const group of groups)
      group.classList.remove('revealing')
  }, { once: true })
  return { duration: STAGGER.step * (STAGGER.count - 1) + DURATIONS.reveal }
}

/** 飘入从反方向来、飘出往这边去；进入下一层 up，返回 down，同一层按左右顺序，下一首 left */
export type Toward = keyof typeof AXES

export interface FloatParams {
  toward: Toward
  /** 默认飘入 12、飘出 6；整页 16 / 8 */
  distance?: number
  /** 不写时按下面 panel 说的那一档 */
  duration?: number
  /** 面板那一档；不写是状态那一档（200 / 120ms） */
  panel?: boolean
  /** 换内容时飘出开始 60ms 后飘入才开始，换碟时歌名晚 80ms 跟着 */
  delay?: number
}

/** 透明度变化的同时朝 toward 漂（DESIGN.md Motion，The Float Rule）：飘入从反方向来、先快后慢，飘出越走越快。漂动写在 translate 上，不碰元素自己的 transform */
export const float = (node: Element, params: FloatParams, options: TransitionOptions = {}): MotionConfig => twoWay(floatOnce, node, params, options)

const floatOnce = (_node: Element, { toward, distance, duration, panel = false, delay = 0 }: FloatParams, options: TransitionOptions): TransitionConfig => {
  if (instant())
    return { duration: 0 }
  const out = options.direction === 'out'
  const ms = duration ?? DURATIONS[panel
    ? (out ? 'panel-out' : 'panel')
    : (out ? 'state-out' : 'state')]
  const easing = easingOf(options)
  if (reducedMotion()) {
    return {
      delay,
      duration: fadeMs(ms),
      easing,
      css: t => `opacity: ${t}`,
    }
  }
  const [x, y] = AXES[toward]
  // 飘入偏在来的那一边（和 toward 相反），飘出偏向去的那一边；u 从 1 到 0 是飘入，从 0 到 1 是飘出
  const reach = (distance ?? (out ? FLOAT_DISTANCE.out : FLOAT_DISTANCE.in)) * (out
    ? 1
    : -1)
  return {
    delay,
    duration: ms,
    easing,
    css: (t, u) => `opacity: ${t}; translate: ${x * reach * u}px ${y * reach * u}px`,
  }
}

const ICON_FROM_SCALE = 0.85

/** 播放 ↔ 暂停 ↔ 转圈、播放模式、音量：新旧图标交叉淡化，新的从 85% 放大到位（反馈 120ms）；写 transition:iconSwap */
export const iconSwap = (node: Element, _params?: undefined, options: TransitionOptions = {}): MotionConfig => twoWay(iconSwapOnce, node, undefined, options)

const iconSwapOnce = (_node: Element, _params: undefined, options: TransitionOptions): TransitionConfig => {
  const out = options.direction === 'out'
  const scaled = !out && !reducedMotion()
  return {
    duration: fadeMs(DURATIONS.feedback),
    easing: easingOf(options),
    css: (t, u) => (scaled
      ? `opacity: ${t}; scale: ${1 - u * (1 - ICON_FROM_SCALE)}`
      : `opacity: ${t}`),
  }
}

/** 正在播放的三根竖条从底下长出来（状态 200ms）、换走时缩回去（退场 120ms）（DESIGN.md Song Row · 点歌）；缩放的底边原点由调用方设 */
export const grow = (_node: Element, _params?: undefined, options: TransitionOptions = {}): TransitionConfig => {
  const ms = options.direction === 'out'
    ? DURATIONS['state-out']
    : DURATIONS.state
  const easing = easingOf(options)
  if (reducedMotion()) {
    return {
      duration: fadeMs(ms),
      easing,
      css: t => `opacity: ${t}`,
    }
  }
  return {
    duration: moveMs(ms),
    easing,
    css: t => `scale: 1 ${t}`,
  }
}

const RECEDE_SCALE = 0.96

/** 手机播放页封面 ↔ 歌词（DESIGN.md Lyrics）：换成歌词时缩到 96% 淡出（退场 200ms），换回时从 96% 放大淡入（面板 360ms）；delay 给换回时的封面 */
export const recede = (_node: Element, { delay = 0 }: { delay?: number } = {}, options: TransitionOptions = {}): TransitionConfig => {
  if (instant())
    return { duration: 0 }
  const ms = options.direction === 'out'
    ? DURATIONS['panel-out']
    : DURATIONS.panel
  const easing = easingOf(options)
  if (reducedMotion()) {
    return {
      delay,
      duration: fadeMs(ms),
      easing,
      css: t => `opacity: ${t}`,
    }
  }
  return {
    delay,
    duration: ms,
    easing,
    css: (t, u) => `opacity: ${t}; scale: ${1 - u * (1 - RECEDE_SCALE)}`,
  }
}

/**
 * 播放条出现、收起（DESIGN.md Player Bars · 出现和换歌）：第一次有歌时从屏幕底下浮上来（面板 360ms），清空（含退出登录）时沉下去（退场 200ms）。
 * 漂多远按离底边多远算，整个藏到屏幕下；translate 的方向也让封面飞行算停稳位置（cover-flight.svelte.ts 的 restingRect）。gone 是队列真的空了，
 * 不是的话（换布局、登录失效）跟着骨架直接拿掉；用 in:dock / out:dock|global。
 */
export const dock = (node: Element, { gone = true }: { gone?: boolean } = {}, options: TransitionOptions = {}): MotionConfig => {
  const out = options.direction === 'out'
  if (out && !gone)
    return {}
  const distance = innerHeight - node.getBoundingClientRect().top
  return float(node, {
    toward: out ? 'down' : 'up',
    distance,
    duration: DURATIONS[out ? 'panel-out' : 'panel'],
  }, options)
}

const POP_DISTANCE = 4
const POP_FROM_SCALE = 0.98

/** 浮动菜单、搜索下拉（DESIGN.md Overlays）：从锚点一侧的 4px 外、98% 大小到位（状态 200ms），关掉只淡出；below 是在锚点下面。写 transition:pop，原点由调用方设 */
export const pop = (node: Element, params: { below: boolean }, options: TransitionOptions = {}): MotionConfig => twoWay(popOnce, node, params, options)

const popOnce = (node: Element, { below }: { below: boolean }, options: TransitionOptions): TransitionConfig => {
  if (options.direction === 'out')
    return fadeOnce(node, {}, options)
  const moved = !reducedMotion()
  const from = (below
    ? -1
    : 1) * POP_DISTANCE
  return {
    duration: fadeMs(DURATIONS.state),
    easing: easingOf(options),
    css: (t, u) => (moved
      ? `opacity: ${t}; translate: 0 ${from * u}px; scale: ${1 - u * (1 - POP_FROM_SCALE)}`
      : `opacity: ${t}`),
  }
}

const DIALOG_DISTANCE = 8

/** 弹窗（DESIGN.md Overlays）：从下面 8px、98% 大小飘到位（面板 360ms），关掉淡出（面板退场 200ms）；写 transition:dialog，遮罩另写 fade（200ms） */
export const dialog = (node: Element, _params?: undefined, options: TransitionOptions = {}): MotionConfig => twoWay(dialogOnce, node, undefined, options)

const dialogOnce = (node: Element, _params: undefined, options: TransitionOptions): TransitionConfig => {
  if (options.direction === 'out')
    return fadeOnce(node, { duration: DURATIONS['panel-out'] }, options)
  const moved = !reducedMotion()
  return {
    duration: fadeMs(DURATIONS.panel),
    easing: easingOf(options),
    css: (t, u) => (moved
      ? `opacity: ${t}; translate: 0 ${DIALOG_DISTANCE * u}px; scale: ${1 - u * (1 - POP_FROM_SCALE)}`
      : `opacity: ${t}`),
  }
}

interface ToastParams {
  /** bottom 从下面飘上来，top 从上面飘下来 */
  edge: 'top' | 'bottom'
  /** 换了位置（手机播放页打开、收起）时只淡入，和旧位置的交叉淡化，不从边上再飘 */
  moved?: boolean
}

/** 提示条（DESIGN.md Overlays）：从贴着的那条边飘进来（12px，状态 200ms），走时只淡出（退场 120ms）；写 transition:toast */
export const toast = (node: Element, params: ToastParams, options: TransitionOptions = {}): MotionConfig => twoWay(toastOnce, node, params, options)

const toastOnce = (node: Element, { edge, moved = false }: ToastParams, options: TransitionOptions): TransitionConfig => options.direction === 'out' || moved
  ? fadeOnce(node, {}, options)
  : floatOnce(node, {
      toward: edge === 'bottom'
        ? 'up'
        : 'down',
    }, options)

/**
 * 会推开下面内容的一条（DESIGN.md Overlays：同步通知条、歌单内“找到几首”、表单报错）：高度从 0 展开（状态 200ms），里面的东西过半后淡入、
 * 从上面 12px 飘下来；收起时先淡出再收回 0。写 transition:unfold，放在没有外边距/内边距/边框的外层上（展开的是它的高度）。
 */
export const unfold = (node: Element, _params?: undefined, options: TransitionOptions = {}): MotionConfig => twoWay(unfoldOnce, node, undefined, options)

const unfoldOnce = (node: Element, _params: undefined, options: TransitionOptions): TransitionConfig => {
  if (reducedMotion() || instant())
    return fadeOnce(node, {}, options)
  // 展开、收起到一半时外层的高度被动画压着：按里面内容的高度算
  const height = node.scrollHeight
  const reach = FLOAT_DISTANCE.in
  return {
    duration: DURATIONS.state,
    easing: easingOf(options),
    css: (t) => {
      const shown = Math.max(0, t * 2 - 1)
      return `height: ${t * height}px; overflow: hidden; opacity: ${shown}; translate: 0 ${(shown - 1) * reach}px`
    },
  }
}

/** 后来加进来的一组依次飘入（歌手页“显示更多专辑”）：从下面 12px 飘上来（240ms），第 order 个晚 order × 30ms，第 6 个以后一起。写 in:stagger */
export const stagger = (node: Element, { order }: { order: number }, options: TransitionOptions = {}): MotionConfig => float(node, { toward: 'up', duration: DURATIONS.reveal, delay: Math.min(order, STAGGER.count - 1) * STAGGER.step }, options)
