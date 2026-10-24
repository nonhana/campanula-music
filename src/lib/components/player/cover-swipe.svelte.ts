import { untrack } from 'svelte'
import type { Attachment } from 'svelte/attachments'

import { WHEEL } from '../shared/motion-tokens'
import { attachGrip, createPageHold } from '../shared/press'
import type { WheelDirection } from './wheel-core'
import { createWheelCore } from './wheel-core'

// 手机播放页左右拖封面切歌（DESIGN.md Cover Wheel）。怎么判断全在 wheel-core.ts（Spec #11 第二个测试接入点“拖动手势核心”），
// 这里只接上浏览器：封面按钮的指针事件、指针捕获和按住断了的几种情况（press.ts 的 attachGrip，和抽屉一样）、
// 量封面多宽、拖着时整页的光标和选字；转盘怎么摆交给 CoverWheel 的 drag

export interface CoverSwipeOptions {
  /** 当前这首的编号：拖着时它变了（放完自动接续），这次拖动作废 */
  current: () => number
  /** 往这边有没有别的歌可换 */
  has: (direction: WheelDirection) => boolean
  /** 松手时过了阈值：切到上一首 / 下一首（和按键一样） */
  commit: (direction: WheelDirection) => void
  /** 轻点封面（键盘的 Enter、空格也算） */
  tap: () => void
}

export interface CoverSwipe {
  /** 转盘被手转了几格（往右为正）；没在拖是 null。交给 CoverWheel 的 drag */
  readonly turned: number | null
  /** 挂在封面按钮上：`{@attach swipe.grip}`，点按也由它接，不用再写 onclick */
  grip: Attachment<HTMLElement>
}

/** 在组件初始化时调用 */
export const createCoverSwipe = ({ current, has, commit, tap }: CoverSwipeOptions): CoverSwipe => {
  let turned = $state<number | null>(null)
  /** 封面按钮多宽（px）：尺寸变了由 ResizeObserver 记下，拖动时不读排版（读一次就可能把整页排版重算一遍） */
  let width = 0
  const holdPage = createPageHold()

  const core = createWheelCore({
    // 手指挪过的距离就是封面中心沿转盘弧线走的距离：一格是半径（轴心到封面中心，1.6 倍边长）乘上 28° 的弧度
    notch: () => WHEEL.pivot * width * WHEEL.pitch * Math.PI / 180,
    has,
    commit,
    tap,
    onPose(pose) {
      holdPage(pose.dragging)
      turned = pose.dragging ? pose.turned : null
    },
  })
  const attach = attachGrip(core)

  $effect(() => {
    current()
    untrack(() => core.abandon())
  })

  return {
    get turned() {
      return turned
    },
    grip(element) {
      const detach = attach(element)
      const observer = new ResizeObserver(([entry]) => (width = entry.borderBoxSize[0].inlineSize))
      observer.observe(element)
      return () => {
        detach?.()
        observer.disconnect()
      }
    },
  }
}
