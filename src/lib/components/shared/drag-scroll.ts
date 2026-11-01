import type { Attachment } from 'svelte/attachments'

import type { Glide } from './drag-scroll-core'
import { createDragScrollCore, frictionGlide, glideEnd, glideTolerance, springGlide } from './drag-scroll-core'
import { reducedMotion } from './motion'
import { attachWindowGrip, createPageHold } from './press'

// 鼠标按住横向滚动的区域拖着滚（DESIGN.md 鼠标拖着滚；ADR-0012）：判断和滑行的物理全在 drag-scroll-core.ts，这里只接浏览器。
// 用 attachWindowGrip：移动、松开听在 window 上，不抓指针，格子里的链接、按钮照常点得到；不写 touch-action，手指照旧由浏览器滚。
// 松手后的滑行逐帧写 scrollLeft；别人一动滚动（滚轮、键盘、翻页键、Tab 到某一格、在哪里按下）就停下让给它。

/** `{@attach dragScroll}` 挂在横着滚的那个元素（overflow-x: auto）上 */
export const dragScroll: Attachment<HTMLElement> = (element) => {
  const holdPage = createPageHold()
  /** 有吸附的（首页歌曲格）：拖着、滑着时关掉，停稳在某一格上再打开，不然每写一次 scrollLeft 浏览器都会吸一下 */
  const snapping = getComputedStyle(element).scrollSnapType !== 'none'
  let dragging = false
  let frame = 0
  /** 滑行上一帧写进去的位置：这一帧读出来不一样，就是别人在滚 */
  let written = 0
  /** 这次按下按停了滑行 */
  let stoppedByPress = false

  const max = () => element.scrollWidth - element.clientWidth

  /** 停稳了：吸附打开（这时正停在某一格上，不会再跳） */
  const settle = () => {
    element.style.scrollSnapType = ''
  }

  const stopGlide = (): boolean => {
    if (!frame)
      return false
    cancelAnimationFrame(frame)
    frame = 0
    window.removeEventListener('pointerdown', onOutsideDown, true)
    return true
  }

  // 在别处按下（翻页键、别的控件）：停下让给它
  const onOutsideDown = (event: PointerEvent) => {
    if (event.target instanceof Node && element.contains(event.target))
      return
    stopGlide()
    settle()
  }

  const glide = (motion: Glide) => {
    stopGlide()
    const start = performance.now()
    written = element.scrollLeft
    window.addEventListener('pointerdown', onOutsideDown, true)
    const step = (now: number) => {
      if (Math.abs(element.scrollLeft - written) > 1) {
        stopGlide()
        settle()
        return
      }
      const t = Math.max(0, now - start) / 1000
      element.scrollLeft = motion.at(t)
      written = element.scrollLeft
      if (motion.done(t)) {
        stopGlide()
        settle()
        return
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  }

  /** 有吸附时浏览器会停到哪一格：打开吸附、瞬间滚到 to、读出来，再关掉、回到原处（同一帧里写完，看不到） */
  const snapOf = (to: number): number => {
    const from = element.scrollLeft
    element.style.scrollSnapType = ''
    element.scrollLeft = to
    const landed = element.scrollLeft
    element.style.scrollSnapType = 'none'
    element.scrollLeft = from
    return landed
  }

  /** 松手、作废、按停了滑行：velocity 是接着滚的速度（px/s） */
  const release = (velocity: number) => {
    // 减少动态效果：不滑；有吸附时直接停到最近的一格
    if (reducedMotion())
      return settle()
    const position = element.scrollLeft
    const tolerance = glideTolerance(window.devicePixelRatio)
    if (snapping) {
      // 浏览器从松手后本来会停的地方挑一格（CSS 吸附选落点的做法），弹簧带着松手的速度停过去；已经在那一格上就不动（Flutter PageScrollPhysics）
      const target = snapOf(glideEnd(position, velocity, max()))
      return target === position
        ? settle()
        : glide(springGlide(position, target, velocity, tolerance))
    }
    if (velocity === 0)
      return settle()
    glide(frictionGlide(position, velocity, max(), tolerance))
  }

  const core = createDragScrollCore({
    begin(sample) {
      // 按在自绘滚动条上：交给它拖滑块、点空白处翻页
      if (sample.target instanceof Element && sample.target.closest('[data-scrollbar]'))
        return null
      const limit = max()
      return limit >= 1
        ? { position: element.scrollLeft, max: limit, stopped: stoppedByPress }
        : null
    },
    onPose(pose) {
      if (pose.dragging) {
        if (!dragging) {
          dragging = true
          holdPage(true)
          // 起拖前那几 px 已经选上的字
          document.getSelection()?.removeAllRanges()
          element.style.scrollSnapType = 'none'
        }
        element.scrollLeft = pose.position
        return
      }
      dragging = false
      holdPage(false)
      release(pose.velocity)
    },
  })

  // 在这块区域里按下：先停下滑行（在抓手之前），这一下由抓手决定接不接；没接（手指、右键、按在滚动条上）就停在这里
  const onDownFirst = () => {
    stoppedByPress = stopGlide()
  }
  const onDownAfter = () => {
    if (stoppedByPress && !core.holding)
      settle()
    stoppedByPress = false
  }
  const onWheel = () => {
    if (stopGlide())
      settle()
  }
  element.addEventListener('pointerdown', onDownFirst, true)
  const detach = attachWindowGrip(core, { touchAction: false })(element)
  element.addEventListener('pointerdown', onDownAfter)
  element.addEventListener('wheel', onWheel, { passive: true })
  return () => {
    element.removeEventListener('pointerdown', onDownFirst, true)
    element.removeEventListener('pointerdown', onDownAfter)
    element.removeEventListener('wheel', onWheel)
    detach?.()
    stopGlide()
    core.abandon()
  }
}
