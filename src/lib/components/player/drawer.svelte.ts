import { untrack } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { quartOut } from 'svelte/easing'
import { Tween } from 'svelte/motion'

import { moveMs } from '../shared/motion'
import { DURATIONS } from '../shared/motion-tokens'
import { attachGrip, createPageHold } from '../shared/press'
import type { GripSource } from './drawer-core'
import { createDrawerCore } from './drawer-core'

// 从底下升起、缩回底下的抽屉（播放页、手机的播放队列弹层）：判断全在 drawer-core.ts（Spec #11 第二个测试接入点），
// 这里只接浏览器（panel 的位置、底下垫的一截、动画、整页光标和选字；指针接线交给 press.ts 的 attachGrip）。
// 动画 380ms（DURATIONS.drawer）先快后慢，中途松手按剩下的距离算；减少动态效果时直接到位（拖动时照样跟手）。

/** 抽屉底下多垫这么多 px（背景和抽屉一样）：拉过头时抽屉会上移一点（有阻尼），垫上这一截不露出后面的页面；拉过头最多也只走这么多 */
const BLEED = 48

export interface Drawer {
  /** 0 整个拉开，1 收在下面；拉过头时略小于 0（有阻尼） */
  readonly position: number
  /** 拉开着、正在动、正在拖：要画出来 */
  readonly visible: boolean
  /** 动到层请求说的那一头；正在拖时先记下，松手没拉到另一头就去 */
  settle: (open: boolean) => void
  /**
   * `{@attach drawer.panel}`：抽屉是 position: fixed 的一层，定好上边和左右，下边交给它（多伸出 48px、底部留同样的内边距再加安全区，
   * 按 position 移动并量高度）。停在整个拉开时不设 transform，里面 fixed 的东西（手机播放页的播放队列弹层）才照常按屏幕摆。
   */
  panel: Attachment<HTMLElement>
  /** `{@attach drawer.grip({ from, commit, tap })}`，每个来源一份；元素设 touch-action: none，点按也由它接 */
  grip: (source: GripSource) => Attachment<HTMLElement>
}

/** 还没画出来时（从播放条往上拖的头几帧）按多高算（px），画出来以后量它自己 */
export const createDrawer = (estimate: () => number): Drawer => {
  const position = new Tween(1, {
    // 中途松手按剩下的距离算，最短也有一下反馈（120ms）
    duration: (from, to) => moveMs(Math.max(DURATIONS.feedback, DURATIONS.drawer * Math.abs(to - from))),
    easing: quartOut,
  })
  let panel: HTMLElement | null = null
  const holdPage = createPageHold()

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
      // 有 transform（还有 will-change）的元素会成为里面 fixed 元素的定位参照，
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
