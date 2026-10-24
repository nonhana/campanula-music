import { untrack } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { quartOut } from 'svelte/easing'
import { Tween } from 'svelte/motion'

import { moveMs } from '../shared/motion'
import { DURATIONS } from '../shared/motion-tokens'
import { attachGrip, createPageHold } from '../shared/press'
import type { GripSource } from './drawer-core'
import { createDrawerCore } from './drawer-core'

// 从底下升起、缩回底下的抽屉（播放页、手机的播放队列弹层）。拖动怎么判断全在 drawer-core.ts（Spec #11 的第二个测试接入点），
// 这里只接上浏览器：抽屉本身（panel）的位置和底下垫的那一截、动画、拖着时整页的光标和选字；
// 拖动来源（grip）的指针事件、指针捕获和按住断了的几种情况交给 press.ts 的 attachGrip。
// 动画 380ms（DURATIONS.drawer）先快后慢，中途松手按剩下的距离算；减少动态效果时直接到位（拖动时照样跟手）

/**
 * 抽屉底下多垫这么多 px（背景和抽屉一样）：往拉开那边拉过头时抽屉会往上走一点（有阻尼），
 * 垫上这一截就不会露出后面的页面；拉过头最多也只走这么多
 */
const BLEED = 48

export interface Drawer {
  /** 0 整个拉开，1 收在下面看不见；拉过头时略小于 0（有阻尼） */
  readonly position: number
  /** 没完全收起（拉开着、正在动、正在拖）：要画出来 */
  readonly visible: boolean
  /** 层的请求说开着 / 关了：动到那一头。正在拖时先记下，松手时没拉到另一头就去那里 */
  settle: (open: boolean) => void
  /**
   * 挂在抽屉本身上：`{@attach drawer.panel}`。抽屉是 position: fixed 的一层，定好上边和左右，下边交给它：
   * 它往下多伸出 48px、底部留出同样的内边距（再加上安全区），按 position 上下移动，并量出抽屉露出来的高度。
   * 停在整个拉开时不设 transform：里面 position: fixed 的东西（手机播放页里的播放队列弹层）照常按屏幕摆
   */
  panel: Attachment<HTMLElement>
  /**
   * 把一个元素变成拖动来源：`{@attach drawer.grip({ from, commit, tap })}`，在组件初始化时创建，每个来源一份。
   * 元素自己会设上 touch-action: none（手机上拖动不被当成滚动）；点按（tap）也由它接，不用再写 onclick
   */
  grip: (source: GripSource) => Attachment<HTMLElement>
}

/** estimate：抽屉还没画出来时（从播放条往上拖的头几帧）按多高算（px），画出来以后量它自己 */
export const createDrawer = (estimate: () => number): Drawer => {
  const position = new Tween(1, {
    // 中途松手时按剩下的距离算，最短也有一下反馈（120ms）
    duration: (from, to) => moveMs(Math.max(DURATIONS.feedback, DURATIONS.drawer * Math.abs(to - from))),
    easing: quartOut,
  })
  let panel: HTMLElement | null = null
  const holdPage = createPageHold()

  /** 抽屉露出来的高度（不含底下垫的那一截） */
  const size = () => (panel
? panel.offsetHeight - BLEED
: estimate())

  const core = createDrawerCore({
    size,
    drawnAt: () => position.current,
    onPose(pose) {
      holdPage(pose.dragging)
      if (pose.dragging)
        void position.set(Math.max(pose.position, -BLEED / size()), { duration: 0 })
      // 不跟着 target 变：调用 settle 的 effect 只该跟着层的请求走
      else if (untrack(() => position.target) !== pose.end)
        void position.set(pose.end)
    },
  })

  return {
    get position() {
      return position.current
    },
    get visible() {
      return position.current < 1
    },
    settle: core.settle,
    panel(element) {
      panel = element
      element.style.bottom = `-${BLEED}px`
      element.style.paddingBottom = `calc(${BLEED}px + env(safe-area-inset-bottom))`
      // 收起时整个露出来的部分刚好移到屏幕下面。有 transform（还有 will-change）的元素会变成里面 fixed 元素的定位参照，
      // 所以停在整个拉开时不设，动起来才设
      $effect(() => {
        const at = position.current
        element.style.transform = at === 0
? ''
: `translateY(calc(${at} * (100% - ${BLEED}px)))`
        element.style.willChange = at === 0
? ''
: 'transform'
      })
      return () => {
        if (panel === element)
          panel = null
      }
    },
    grip: source => attachGrip(core.grip(source)),
  }
}
