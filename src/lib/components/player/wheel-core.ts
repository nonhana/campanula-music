import type { Grip } from '../press'
import { pressBroken } from '../press'

// 手机播放页左右拖封面切歌的手势核心（DESIGN.md Cover Wheel；Spec #11 第二个测试接入点“拖动手势核心”的转盘那一半，另一半是 drawer-core.ts）：
// 不碰页面、不碰 Svelte 的纯逻辑。封面按钮把按下、移动、松开、点击交给它，它说转盘跟着手转了几格、松手切不切歌、这次算不算点按。
// 往右拖是顺时针转（格数为正），松手切到上一首；往左拖切到下一首

/** 切到上一首还是下一首 */
export type WheelDirection = 'previous' | 'next'

/** 转盘该怎么摆：拖着时被手转了几格（从按下的地方算，往右为正），不然停在原位（切歌时由换碟接着转） */
export type WheelPose
  = | { dragging: true, turned: number }
    | { dragging: false }

export interface WheelCore extends Grip {
  readonly pose: WheelPose
}

export interface WheelCoreOptions {
  /** 手指横着挪多少 px，转盘转一格（相邻两张封面之间） */
  notch: () => number
  /** 往这边有没有别的歌可换：播放队列里只有一首时两边都没有，拖得动，松手总是转回原位 */
  has: (direction: WheelDirection) => boolean
  /** 松手时过了阈值：切到上一首 / 下一首 */
  commit: (direction: WheelDirection) => void
  /** 没拖动、只是点按（键盘的 Enter、空格也算） */
  tap: () => void
  /** pose 变了 */
  onPose: (pose: WheelPose) => void
}

/** 横着挪过这么多（px）才算拖 */
const SLOP = 6
/** 松手时拖过一格的这么多就切歌 */
const THRESHOLD = 0.25
/** 整段拖动的速度超过这么多（px/ms，每秒 1000px）就算一甩：拖得再短也切歌 */
const FLICK = 1

interface Press {
  pointerId: number
  /** 按下的地方和时刻：拖过的距离、一甩的速度都从这里算 */
  x: number
  y: number
  time: number
  /** 已经开始拖了（横着挪够了起拖距离） */
  dragging: boolean
}

export function createWheelCore({ notch, has, commit, tap, onPose }: WheelCoreOptions): WheelCore {
  let pose: WheelPose = { dragging: false }
  let press: Press | null = null
  /** 拖过之后跟着来的那次指针 click 不算点按（下次按下时清掉） */
  let swallowClick = false

  function setPose(next: WheelPose) {
    pose = next
    onPose(next)
  }

  function abandon(pointerId?: number) {
    if (!press || (pointerId !== undefined && pointerId !== press.pointerId))
      return
    const wasDragging = press.dragging
    press = null
    swallowClick = true
    if (wasDragging)
      setPose({ dragging: false })
  }

  return {
    get pose() {
      return pose
    },
    get holding() {
      return press !== null
    },
    press(sample) {
      if (!sample.isPrimary || sample.button !== 0)
        return false
      abandon()
      swallowClick = false
      press = { pointerId: sample.pointerId, x: sample.x, y: sample.y, time: sample.time, dragging: false }
      return true
    },
    move(sample) {
      if (press?.pointerId !== sample.pointerId)
        return
      if (pressBroken(sample.buttons))
        return abandon()
      const dx = sample.x - press.x
      if (!press.dragging) {
        const across = Math.abs(dx)
        const down = Math.abs(sample.y - press.y)
        if (across < SLOP && down < SLOP)
          return
        if (across <= down) {
          // 先竖着挪的：不是拖转盘，也不是点按
          press = null
          swallowClick = true
          return
        }
        press.dragging = true
      }
      setPose({ dragging: true, turned: dx / notch() })
    },
    release(sample) {
      if (press?.pointerId !== sample.pointerId)
        return
      const ended = press
      press = null
      if (!ended.dragging)
        return
      swallowClick = true
      const distance = sample.x - ended.x
      const velocity = Math.abs(distance) / Math.max(1, sample.time - ended.time)
      const direction: WheelDirection = distance > 0 ? 'previous' : 'next'
      setPose({ dragging: false })
      if ((velocity > FLICK || Math.abs(distance) >= notch() * THRESHOLD) && has(direction))
        commit(direction)
    },
    abandon,
    click(detail) {
      const swallow = swallowClick && detail > 0
      swallowClick = false
      if (!swallow)
        tap()
      return swallow
    },
  }
}
