import type { TransitionConfig } from 'svelte/transition'
import { prefersReducedMotion } from 'svelte/motion'
import { AXES, DURATIONS, EASINGS, FLOAT_DISTANCE, REDUCED_FADE_MS, STAGGER } from './motion-tokens'

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

/** 透明度、颜色的时长：减少动态效果时最多 150ms，页面在后台时是 0 */
export function fadeMs(ms: number): number {
  if (unseen())
    return 0
  return reducedMotion() ? Math.min(ms, REDUCED_FADE_MS) : ms
}

/** 位移、缩放、宽高的时长：减少动态效果、页面在后台时是 0，直接到位 */
export function moveMs(ms: number): number {
  return reducedMotion() || unseen() ? 0 : ms
}

/** 程序滚动（翻页键、歌词跟着当前行走）：减少动态效果时直接跳过去 */
export function scrollBehavior(): ScrollBehavior {
  return reducedMotion() ? 'auto' : 'smooth'
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

/** Svelte 传给过渡函数的第三个参数：in: / out: 各是 in / out，transition: 是 both（按飘入算） */
export interface TransitionOptions {
  direction?: 'in' | 'out' | 'both'
}

/** 进来先快后慢，出去越走越快 */
function easingOf(options: TransitionOptions): (t: number) => number {
  return options.direction === 'out' ? easeInSoft : easeOutSoft
}

/** 淡入淡出：同一块地方换内容时交叉淡化（封面染底、手机播放页的封面 ↔ 歌词），加载不出来的图标淡入。duration 默认 200ms（状态） */
export function fade(_node: Element, { duration = DURATIONS.state }: { duration?: number } = {}, options: TransitionOptions = {}): TransitionConfig {
  return {
    duration: fadeMs(duration),
    easing: easingOf(options),
    css: t => `opacity: ${t}`,
  }
}

/**
 * 骨架淡出（DESIGN.md Motion · 依次飘入）：写成 out:fadeAway，放在被内容替换掉的骨架上（骨架是上下排列里的一块）。
 * 淡出的这一会儿（退场 120ms）不再占高度：下边距减掉自己的高度，后面换上来的内容马上从骨架的位置开始，
 * 不会先被骨架往下推一下；骨架还留在排版里，上面的东西变高变矮时跟着一起走。点按穿过它落到内容上
 */
export function fadeAway(node: HTMLElement, _params?: undefined, options: TransitionOptions = {}): TransitionConfig {
  node.style.marginBottom = `calc(${getComputedStyle(node).marginBottom} - ${node.offsetHeight}px)`
  node.style.pointerEvents = 'none'
  return {
    duration: fadeMs(DURATIONS['state-out']),
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
  /** 默认飘入 200ms（状态）、飘出 120ms；整页 360 / 200 */
  duration?: number
  /** 换内容时，飘出开始 60ms 后飘入才开始 */
  delay?: number
}

/**
 * 飘入飘出（DESIGN.md Motion，The Float Rule）：透明度变化的同时朝 toward 那边漂。
 * 飘入从反方向漂过来停住，先快后慢；飘出往 toward 漂走，越走越快。用 in:float 和 out:float 分开写，进出各按各的规矩；
 * transition:float 两头都按飘入算。减少动态效果时不漂，只淡入淡出（最多 150ms）；页面在后台时不等 delay，直接到位。
 * 漂动写在 translate 上，不碰元素自己的 transform
 */
export function float(_node: Element, { toward, distance, duration, delay = 0 }: FloatParams, options: TransitionOptions = {}): TransitionConfig {
  if (unseen())
    return { duration: 0 }
  const out = options.direction === 'out'
  const ms = duration ?? (out ? DURATIONS['state-out'] : DURATIONS.state)
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
 * 图标切换（播放 ↔ 暂停 ↔ 转圈）：新旧两个图标交叉淡化，新的从 85% 放大到位（反馈 120ms）。
 * 新旧叠在同一个网格格子里，用 in:iconSwap 和 out:iconSwap。减少动态效果时只淡入淡出
 */
export function iconSwap(_node: Element, _params?: undefined, options: TransitionOptions = {}): TransitionConfig {
  const out = options.direction === 'out'
  const scaled = !out && !reducedMotion()
  return {
    duration: fadeMs(DURATIONS.feedback),
    easing: easingOf(options),
    css: (t, u) => (scaled ? `opacity: ${t}; scale: ${1 - u * (1 - ICON_FROM_SCALE)}` : `opacity: ${t}`),
  }
}

/** 浮动菜单飘出来时从多远（px）、多大开始 */
const POP_DISTANCE = 4
const POP_FROM_SCALE = 0.98

/**
 * 浮动菜单、搜索下拉（DESIGN.md Overlays）：从锚点那一侧飘出来，从 4px 外、98% 大小到位（状态 200ms）；关掉时只淡出（退场 120ms）。
 * below：菜单在锚点下面（从上面 4px 飘下来），否则在上面。用 in:pop 和 out:pop；缩放的原点由调用的地方用 transform-origin 定。
 * 减少动态效果时只淡入淡出
 */
export function pop(_node: Element, { below }: { below: boolean }, options: TransitionOptions = {}): TransitionConfig {
  if (options.direction === 'out')
    return { duration: fadeMs(DURATIONS['state-out']), easing: easingOf(options), css: t => `opacity: ${t}` }
  const moved = !reducedMotion()
  const from = (below ? -1 : 1) * POP_DISTANCE
  return {
    duration: fadeMs(DURATIONS.state),
    easing: easingOf(options),
    css: (t, u) => (moved ? `opacity: ${t}; translate: 0 ${from * u}px; scale: ${1 - u * (1 - POP_FROM_SCALE)}` : `opacity: ${t}`),
  }
}
