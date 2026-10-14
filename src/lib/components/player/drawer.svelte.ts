import type { Attachment } from 'svelte/attachments'
import type { GripSource, PointerSample } from './drawer-core'
import { untrack } from 'svelte'
import { quartOut } from 'svelte/easing'
import { prefersReducedMotion, Tween } from 'svelte/motion'
import { createDrawerCore } from './drawer-core'
import { watchPress } from './press'

// 从底下升起、缩回底下的抽屉（播放页、手机的播放队列弹层）。拖动怎么判断全在 drawer-core.ts（Spec #11 的第二个测试接入点），
// 这里只接上浏览器：抽屉本身（panel）的位置和底下垫的那一截、拖动来源（grip）的指针事件和指针捕获、
// 按住断了的几种情况（press.ts）、动画、拖着时整页的光标和选字。
// 动画 380ms 先快后慢，中途松手按剩下的距离算；减少动态效果时直接到位（拖动时照样跟手）

/** 从收着到整个拉开的时长 */
const FULL_MS = 380

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
  /** 浅路由说开着 / 关了：动到那一头。正在拖时先记下，松手时没拉到另一头就去那里 */
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
export function createDrawer(estimate: () => number): Drawer {
  const position = new Tween(1, {
    duration: (from, to) => (prefersReducedMotion.current ? 0 : Math.max(120, FULL_MS * Math.abs(to - from))),
    easing: quartOut,
  })
  let panel: HTMLElement | null = null
  let held = false

  /** 抽屉露出来的高度（不含底下垫的那一截） */
  const size = () => (panel ? panel.offsetHeight - BLEED : estimate())

  /** 拖着时整页不选字，光标是抓着的手 */
  function holdPage(hold: boolean) {
    if (hold === held)
      return
    held = hold
    const { style } = document.documentElement
    style.cursor = hold ? 'grabbing' : ''
    style.userSelect = hold ? 'none' : ''
  }

  const core = createDrawerCore({
    size,
    drawnAt: () => position.current,
    onPose(pose) {
      holdPage(pose.dragging)
      if (pose.dragging)
        void position.set(Math.max(pose.position, -BLEED / size()), { duration: 0 })
      // 不跟着 target 变：调用 settle 的 effect 只该跟着浅路由走
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
        element.style.transform = at === 0 ? '' : `translateY(calc(${at} * (100% - ${BLEED}px)))`
        element.style.willChange = at === 0 ? '' : 'transform'
      })
      return () => {
        if (panel === element)
          panel = null
      }
    },
    grip(source) {
      const grip = core.grip(source)
      return (element) => {
        /** 停止盯着这次按住；没按着时是 null */
        let unwatch: (() => void) | null = null
        /** 这次按住结束了（松开、作废、按住断了）就不再盯着 */
        const settleWatch = () => {
          if (grip.holding)
            return
          unwatch?.()
          unwatch = null
        }
        /** 右键菜单、切走窗口、页面藏起来：这次按住作废 */
        const abandonPress = () => {
          grip.abandon()
          settleWatch()
        }
        const sample = (event: PointerEvent): PointerSample => ({
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          isPrimary: event.isPrimary,
          button: event.button,
          buttons: event.buttons,
          x: event.clientX,
          y: event.clientY,
          time: event.timeStamp,
        })
        const listeners = {
          pointerdown(event: PointerEvent) {
            if (!grip.press(sample(event)))
              return
            unwatch?.()
            unwatch = watchPress(abandonPress)
            element.setPointerCapture(event.pointerId)
          },
          pointermove(event: PointerEvent) {
            grip.move(sample(event))
            settleWatch()
          },
          pointerup(event: PointerEvent) {
            grip.release(sample(event))
            settleWatch()
          },
          // 只管这根指针：第二根手指被取消、收回捕获不影响正在拖的这次。正常松开后浏览器也会收回捕获，那时这次按住已经结束
          pointercancel(event: PointerEvent) {
            grip.abandon(event.pointerId)
            settleWatch()
          },
          lostpointercapture(event: PointerEvent) {
            grip.abandon(event.pointerId)
            settleWatch()
          },
          click: (event: MouseEvent) => grip.click(event.detail),
        }
        element.style.touchAction = 'none'
        for (const [type, listener] of Object.entries(listeners))
          element.addEventListener(type, listener as EventListener)
        return () => {
          for (const [type, listener] of Object.entries(listeners))
            element.removeEventListener(type, listener as EventListener)
          // 拖着时元素没了（例如播放队列被清空）：作废，光标、选字放开
          abandonPress()
        }
      }
    },
  }
}
