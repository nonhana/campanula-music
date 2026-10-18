import type { TransitionConfig } from 'svelte/transition'
import { flushSync } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import { AXES, cssEasing, DURATIONS, EASINGS, FLOAT_DISTANCE, REDUCED_FADE_MS, STAGGER } from './motion-tokens'

// 组件里的 JS 动效（Svelte 过渡、Tween、换碟、程序滚动）从这里取时长和曲线，减少动态效果也在这里统一处理（DESIGN.md Motion）：
// 位移、缩放、平滑滚动去掉，淡入淡出和颜色变化留着、最多 150ms。组件里不再自己判断。CSS 那一半在 uno.config.ts。
// 看不见时不动：页面在后台（锁屏、切走）时时长都是 0，状态直接到位。浏览器在后台不画帧，这时开始的动画要等回到前台才播，就成了补放

/** 系统设置里打开了“减少动态效果” */
export function reducedMotion(): boolean {
  return prefersReducedMotion.current
}

/** 页面在后台（锁屏、切走）：动效直接到位，回来时不补放 */
export function unseen(): boolean {
  return document.visibilityState === 'hidden'
}

/** 正在 atOnce() 里 */
let settling = false

/**
 * 状态一下子到位、不播过渡：返回一页时恢复的筛选、搜索词（snapshot.ts）。change 里改的状态当场画好，
 * 换页的过渡拍新的一帧时已经是恢复好的样子，滚动位置也按恢复好的高度算。不能在 effect 里调（flushSync）
 */
export function atOnce(change: () => void): void {
  settling = true
  try {
    flushSync(change)
  }
  finally {
    settling = false
  }
}

/** 页面在后台，或者正在 atOnce() 里：直接到位 */
function instant(): boolean {
  return settling || unseen()
}

/** 透明度、颜色的时长：减少动态效果时最多 150ms，页面在后台时是 0 */
export function fadeMs(ms: number): number {
  if (instant())
    return 0
  return reducedMotion() ? Math.min(ms, REDUCED_FADE_MS) : ms
}

/** 位移、缩放、宽高的时长：减少动态效果、页面在后台时是 0，直接到位 */
export function moveMs(ms: number): number {
  return reducedMotion() || instant() ? 0 : ms
}

/** 程序滚动（翻页键、歌词跟着当前行走）：减少动态效果时直接跳过去 */
export function scrollBehavior(): ScrollBehavior {
  return reducedMotion() ? 'auto' : 'smooth'
}

/**
 * 一次性的布局变化（DESIGN.md Motion · 不动布局的例外：专辑简介展开收起、登录卡片换登录方式时变高变矮）：
 * 元素的高度从 from 变到 to（duration 是令牌里的时长，减少动态效果时直接到位），曲线 ease-out-soft；
 * 变的这一会儿竖着超出的部分裁掉，横着飘的不裁。没有要动的时候返回 null。
 * 连着变时，调用的地方先量此刻的高度、再 cancel 上一次的，从此刻的样子接着变
 */
export function animateHeight(element: HTMLElement, from: number, to: number, duration: number): Animation | null {
  const ms = moveMs(duration)
  if (ms === 0 || Math.abs(to - from) < 1)
    return null
  return element.animate(
    [{ height: `${from}px`, overflowY: 'clip' }, { height: `${to}px`, overflowY: 'clip' }],
    { duration: ms, easing: cssEasing('out-soft') },
  )
}

/** CSS 的 cubic-bezier(x1, y1, x2, y2) 换成 JS 的缓动函数，和 CSS 里是同一条曲线（WebKit UnitBezier 的解法） */
function cubicBezier([x1, y1, x2, y2]: readonly [number, number, number, number]): (t: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const x = (s: number) => ((ax * s + bx) * s + cx) * s
  const y = (s: number) => ((ay * s + by) * s + cy) * s
  const slope = (s: number) => (3 * ax * s + 2 * bx) * s + cx
  /** 横坐标是 t 的那一点的参数：先用牛顿法，斜率太平时退回二分 */
  function solve(t: number): number {
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
  return t => (t <= 0 ? 0 : t >= 1 ? 1 : y(solve(t)))
}

export const easeOutSoft = cubicBezier(EASINGS['out-soft'])
const easeInSoft = cubicBezier(EASINGS['in-soft'])

/** Svelte 传给过渡函数的第三个参数：in: / out: 各是 in / out，transition: 是 both（见 twoWay） */
export interface TransitionOptions {
  direction?: 'in' | 'out' | 'both'
}

/** 过渡函数给 Svelte 的：in: / out: 是一份配置；transition: 是按方向给配置的函数 */
export type MotionConfig = TransitionConfig | ((options?: { direction?: 'in' | 'out' }) => TransitionConfig)

/**
 * transition: 写法（一个指令管进出）：进出仍各按各的规矩（飘入先快后慢、飘出越走越快、各自的时长），
 * 会被连按、连点、来回切的（菜单、提示、清除按钮、一块地方换内容）都写 transition:。
 * 中途掉头时 Svelte 从此刻的进度接着走（DESIGN.md Motion · 随时可打断）：这一趟的样子（往哪漂、漂多远、缩放）沿用开始时那个方向的，
 * 只换时长和曲线，所以是沿着来的路回去，不先跳到另一边。in: / out: 分开写时掉头会先跳回起点。
 * 这样写时 delay 只给刚进来的那一头：新内容等一下再进来，旧的马上走；掉头回来的不等。正在 atOnce() 里、页面在后台时直接到位
 */
function twoWay<P>(motion: (node: Element, params: P, options: TransitionOptions) => TransitionConfig, node: Element, params: P, options: TransitionOptions): MotionConfig {
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
    return { ...config, css: path, delay: direction === 'out' || turning ? 0 : config.delay }
  }
}

/** 进来先快后慢，出去越走越快 */
function easingOf(options: TransitionOptions): (t: number) => number {
  return options.direction === 'out' ? easeInSoft : easeOutSoft
}

interface FadeParams {
  /** 两头都按这个时长；不写时淡入 200ms（状态）、淡出 120ms（退场） */
  duration?: number
  delay?: number
}

/**
 * 淡入淡出：同一块地方换内容时交叉淡化（新旧叠在同一个网格格子里），加载不出来的图标淡入，跟着数据冒出来的小东西（徽标、数字）。
 * 不写 duration 时淡入 200ms、淡出 120ms
 */
export function fade(node: Element, params: FadeParams = {}, options: TransitionOptions = {}): MotionConfig {
  return twoWay(fadeOnce, node, params, options)
}

function fadeOnce(_node: Element, { duration, delay = 0 }: FadeParams, options: TransitionOptions): TransitionConfig {
  const out = options.direction === 'out'
  return {
    delay: instant() ? 0 : delay,
    duration: fadeMs(duration ?? (out ? DURATIONS['state-out'] : DURATIONS.state)),
    easing: easingOf(options),
    css: t => `opacity: ${t}`,
  }
}

/**
 * 先淡出再淡入（DESIGN.md Overlays · 筛选）：一块地方整个换成别的（歌单筛选），旧的先淡出（退场 120ms），淡完新的再淡入（240ms），
 * 不让里面的东西各自挪位。新旧叠在同一个网格格子里，写 transition:fadeThrough
 */
export function fadeThrough(node: Element, _params?: undefined, options: TransitionOptions = {}): MotionConfig {
  return twoWay(fadeThroughOnce, node, undefined, options)
}

function fadeThroughOnce(node: Element, _params: undefined, options: TransitionOptions): TransitionConfig {
  return options.direction === 'out'
    ? fadeOnce(node, {}, options)
    : fadeOnce(node, { duration: DURATIONS.reveal, delay: fadeMs(DURATIONS['state-out']) }, options)
}

/**
 * 骨架淡出（DESIGN.md Motion · 依次飘入）：写成 out:fadeAway，放在被内容替换掉的骨架上（骨架是上下排列里的一块）。
 * 淡出的这一会儿（退场 120ms）不再占高度：下边距减掉自己的高度，后面换上来的内容马上从骨架的位置开始，
 * 不会先被骨架往下推一下；骨架还留在排版里，上面的东西变高变矮时跟着一起走。点按穿过它落到内容上。
 * 一块骨架只在最外层写一次，不要套在另一个 out:fadeAway 里面（SkeletonRows 自己带）：隔着 {@render}、{:else if}、组件时
 * 里外两层会一起播，外层先量出整块的高度减掉，里层再减一次把外层压扁，后面的内容就被往上拉了里层那么高（#32 综合的单曲）
 */
export function fadeAway(node: HTMLElement, { duration = DURATIONS['state-out'] }: { duration?: number } = {}, options: TransitionOptions = {}): TransitionConfig {
  node.style.marginBottom = `calc(${getComputedStyle(node).marginBottom} - ${node.offsetHeight}px)`
  node.style.pointerEvents = 'none'
  return {
    duration: fadeMs(duration),
    easing: easingOf(options),
    css: t => `opacity: ${t}`,
  }
}

/** 依次飘入的一组：node 里标了 data-reveal-group 的元素（虚拟列表、网格），没有就是 node 自己 */
const REVEAL_GROUP = '[data-reveal-group]'

/**
 * 骨架换成内容时依次飘入（DESIGN.md Motion）：写成 in:reveal，放在骨架所在 {#if} 的另一个分支里。
 * 本地过渡只在骨架换成内容（或空、出错）时播放；页面打开时内容已经在了就不播，换页时整页一起飘。
 * 飘的是一组的直接子元素：前 6 个依次晚 30ms 从下面飘上来，其余和第 6 个一起（uno.config.ts 的 .revealing）。
 * .revealing 只在这一小会儿挂着，之后才挂上的（虚拟列表滚出来的行）不飘。减少动态效果时只淡入
 */
export function reveal(node: HTMLElement): TransitionConfig {
  const found = [...node.querySelectorAll(REVEAL_GROUP)]
  const groups = found.length > 0 ? found : [node]
  for (const group of groups)
    group.classList.add('revealing')
  node.addEventListener('introend', () => {
    for (const group of groups)
      group.classList.remove('revealing')
  }, { once: true })
  return { duration: STAGGER.step * (STAGGER.count - 1) + DURATIONS.reveal }
}

/** 往哪边走：飘入从反方向来，飘出往这边去。进入下一层 up，返回 down，同一层按左右顺序，下一首 left */
export type Toward = keyof typeof AXES

export interface FloatParams {
  toward: Toward
  /** 漂多远（px）：默认飘入 12、飘出 6；整页 16 / 8 */
  distance?: number
  /** 两头都按这个时长；不写时按下面 panel 说的那一档 */
  duration?: number
  /** 面板那一档：飘入 360ms、飘出 200ms；不写是状态那一档：飘入 200ms、飘出 120ms */
  panel?: boolean
  /** 等多久才开始：换内容时飘出开始 60ms 后飘入才开始，换碟时歌名晚 80ms 跟着（transition: 写法只给飘入） */
  delay?: number
}

/**
 * 飘入飘出（DESIGN.md Motion，The Float Rule）：透明度变化的同时朝 toward 那边漂。
 * 飘入从反方向漂过来停住，先快后慢；飘出往 toward 漂走，越走越快。in:float 和 out:float 分开写，或者写 transition:float（见 twoWay）。
 * 减少动态效果时不漂，只淡入淡出（最多 150ms）；页面在后台时不等 delay，直接到位。漂动写在 translate 上，不碰元素自己的 transform
 */
export function float(node: Element, params: FloatParams, options: TransitionOptions = {}): MotionConfig {
  return twoWay(floatOnce, node, params, options)
}

function floatOnce(_node: Element, { toward, distance, duration, panel = false, delay = 0 }: FloatParams, options: TransitionOptions): TransitionConfig {
  if (instant())
    return { duration: 0 }
  const out = options.direction === 'out'
  const ms = duration ?? DURATIONS[panel ? (out ? 'panel-out' : 'panel') : (out ? 'state-out' : 'state')]
  const easing = easingOf(options)
  if (reducedMotion())
    return { delay, duration: fadeMs(ms), easing, css: t => `opacity: ${t}` }
  const [x, y] = AXES[toward]
  // 飘入时偏在来的那一边（和 toward 相反），飘出时偏向去的那一边；u 从 1 到 0 是飘入，从 0 到 1 是飘出
  const reach = (distance ?? (out ? FLOAT_DISTANCE.out : FLOAT_DISTANCE.in)) * (out ? 1 : -1)
  return {
    delay,
    duration: ms,
    easing,
    css: (t, u) => `opacity: ${t}; translate: ${x * reach * u}px ${y * reach * u}px`,
  }
}

/** 新图标从这么大放大到位 */
const ICON_FROM_SCALE = 0.85

/**
 * 图标切换（播放 ↔ 暂停 ↔ 转圈、播放模式、音量）：新旧两个图标交叉淡化，新的从 85% 放大到位（反馈 120ms）。
 * 新旧叠在同一个网格格子里，写 transition:iconSwap。减少动态效果时只淡入淡出
 */
export function iconSwap(node: Element, _params?: undefined, options: TransitionOptions = {}): MotionConfig {
  return twoWay(iconSwapOnce, node, undefined, options)
}

function iconSwapOnce(_node: Element, _params: undefined, options: TransitionOptions): TransitionConfig {
  const out = options.direction === 'out'
  const scaled = !out && !reducedMotion()
  return {
    duration: fadeMs(DURATIONS.feedback),
    easing: easingOf(options),
    css: (t, u) => (scaled ? `opacity: ${t}; scale: ${1 - u * (1 - ICON_FROM_SCALE)}` : `opacity: ${t}`),
  }
}

/**
 * 正在播放的三根竖条从底下长出来（状态 200ms），换走时缩回去（退场 120ms）（DESIGN.md Song Row · 点歌）。
 * 缩放的原点由调用的地方放在底边。减少动态效果时竖条不长，只淡入淡出
 */
export function grow(_node: Element, _params?: undefined, options: TransitionOptions = {}): TransitionConfig {
  const ms = options.direction === 'out' ? DURATIONS['state-out'] : DURATIONS.state
  const easing = easingOf(options)
  if (reducedMotion())
    return { duration: fadeMs(ms), easing, css: t => `opacity: ${t}` }
  return { duration: moveMs(ms), easing, css: t => `scale: 1 ${t}` }
}

/** 手机播放页的封面换成歌词时缩到这么大 */
const RECEDE_SCALE = 0.96

/**
 * 手机播放页封面 ↔ 歌词（DESIGN.md Lyrics）：封面换成歌词时缩到 96% 并淡出（退场 200ms），换回时从 96% 放大到位、淡入（面板 360ms）。
 * 用 in:recede 和 out:recede，delay 给换回时的封面（飘出开始 60ms 后才进来）；缩放的原点是元素中心。减少动态效果时只淡入淡出
 */
export function recede(_node: Element, { delay = 0 }: { delay?: number } = {}, options: TransitionOptions = {}): TransitionConfig {
  if (instant())
    return { duration: 0 }
  const ms = options.direction === 'out' ? DURATIONS['panel-out'] : DURATIONS.panel
  const easing = easingOf(options)
  if (reducedMotion())
    return { delay, duration: fadeMs(ms), easing, css: t => `opacity: ${t}` }
  return { delay, duration: ms, easing, css: (t, u) => `opacity: ${t}; scale: ${1 - u * (1 - RECEDE_SCALE)}` }
}

/**
 * 播放条出现、收起（DESIGN.md Player Bars · 出现和换歌）：播放队列里第一次有歌时从屏幕底下浮上来（面板 360ms），
 * 清空（包括退出登录）时沉下去（退场 200ms）。漂多远按它离屏幕底边多远算，整个藏到屏幕下面；
 * 漂动写在 translate 上（float），点歌时飞来的封面按它算播放条停稳的位置（player/cover-flight.svelte.ts 的 restingRect）。
 * 用 in:dock 和 out:dock|global：骨架整个拿掉时（退出登录）也沉下去。gone 是播放队列真的空了；不是的话
 * （换了手机 / 桌面布局、登录失效）跟着骨架直接拿掉。减少动态效果时只淡入淡出
 */
export function dock(node: Element, { gone = true }: { gone?: boolean } = {}, options: TransitionOptions = {}): MotionConfig {
  const out = options.direction === 'out'
  if (out && !gone)
    return {}
  const distance = innerHeight - node.getBoundingClientRect().top
  return float(node, { toward: out ? 'down' : 'up', distance, duration: DURATIONS[out ? 'panel-out' : 'panel'] }, options)
}

/** 浮动菜单飘出来时从多远（px）、多大开始 */
const POP_DISTANCE = 4
const POP_FROM_SCALE = 0.98

/**
 * 浮动菜单、搜索下拉（DESIGN.md Overlays）：从锚点那一侧飘出来，从 4px 外、98% 大小到位（状态 200ms）；关掉时只淡出（退场 120ms）。
 * below：菜单在锚点下面（从上面 4px 飘下来），否则在上面。写 transition:pop；缩放的原点由调用的地方用 transform-origin 定。
 * 减少动态效果时只淡入淡出
 */
export function pop(node: Element, params: { below: boolean }, options: TransitionOptions = {}): MotionConfig {
  return twoWay(popOnce, node, params, options)
}

function popOnce(node: Element, { below }: { below: boolean }, options: TransitionOptions): TransitionConfig {
  if (options.direction === 'out')
    return fadeOnce(node, {}, options)
  const moved = !reducedMotion()
  const from = (below ? -1 : 1) * POP_DISTANCE
  return {
    duration: fadeMs(DURATIONS.state),
    easing: easingOf(options),
    css: (t, u) => (moved ? `opacity: ${t}; translate: 0 ${from * u}px; scale: ${1 - u * (1 - POP_FROM_SCALE)}` : `opacity: ${t}`),
  }
}

interface ToastParams {
  /** 提示条贴着哪条边：bottom 从下面飘上来，top 从上面飘下来 */
  edge: 'top' | 'bottom'
  /** 换了位置（手机播放页打开、收起）：新位置上的只淡入，和旧位置上的交叉淡化，不从边上再飘一次 */
  moved?: boolean
}

/**
 * 提示条（DESIGN.md Overlays：播放提示…）：从它贴着的那条边飘进来（12px，状态 200ms），走时只淡出（退场 120ms）。
 * 写 transition:toast。减少动态效果时只淡入淡出
 */
export function toast(node: Element, params: ToastParams, options: TransitionOptions = {}): MotionConfig {
  return twoWay(toastOnce, node, params, options)
}

function toastOnce(node: Element, { edge, moved = false }: ToastParams, options: TransitionOptions): TransitionConfig {
  return options.direction === 'out' || moved
    ? fadeOnce(node, {}, options)
    : floatOnce(node, { toward: edge === 'bottom' ? 'up' : 'down' }, options)
}

/**
 * 会推开下面内容的一条（DESIGN.md Overlays：首次同步的通知条；歌单内搜索的“找到几首”、表单下面的报错和提示这类）：
 * 高度从 0 展开（状态 200ms），里面的东西在展开过半后淡入、从上面 12px 飘下来；收起时反过来，先淡出（约 120ms）再收回 0。
 * 这是“不动布局”的例外（一次性的布局变化）。写 transition:unfold，放在没有外边距、内边距、边框的外层上（展开的是它的高度）。
 * 透明度、位移只跟着展开了多少走，中途掉头时从此刻的样子接着走。减少动态效果时高度直接到位，只淡入淡出
 */
export function unfold(node: Element, _params?: undefined, options: TransitionOptions = {}): MotionConfig {
  return twoWay(unfoldOnce, node, undefined, options)
}

function unfoldOnce(node: Element, _params: undefined, options: TransitionOptions): TransitionConfig {
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

/**
 * 一组里后来加进来的依次飘入（歌手页“显示更多专辑”）：和骨架换成内容一样（DESIGN.md Motion · 依次飘入），
 * 从下面 12px 飘上来（240ms），加进来的第 order 个（从 0 数）晚 order × 30ms，第 6 个以后和第 6 个一起。写 in:stagger
 */
export function stagger(node: Element, { order }: { order: number }, options: TransitionOptions = {}): MotionConfig {
  return float(node, { toward: 'up', duration: DURATIONS.reveal, delay: Math.min(order, STAGGER.count - 1) * STAGGER.step }, options)
}
