import type { Grip, PointerSample } from './press'
import { clamp } from './clamp'
import { pressBroken } from './press'

// 线性拖动核心（进度条、自绘滚动条的滑块共用；Spec #11 第二个测试接入点“拖动手势核心”）：
// 不碰页面、不碰 Svelte 的纯逻辑。按下时把指针在元素上的位置换成一个值（0 到 1），拖动时跟着走，松手才提交；
// 只认主指针的主键，第二根手指按下、松开都不插手；按住断了（右键、切走窗口、指针被收回）作废，不提交。

export interface SliderCoreOptions {
  /** 按下：返回这一刻的值，null 是这次按下不接（例如点在滚动条滑块前后的空白处） */
  begin: (sample: PointerSample) => number | null
  /** 拖动中：指针现在对应哪个值 */
  track: (sample: PointerSample) => number
  /** 松手：提交最后的值 */
  commit: (value: number) => void
  /** 作废：回到开始前，不提交 */
  cancel: () => void
  /** 值变了（拖动中是 0 到 1，没拖时是 null） */
  onValue: (value: number | null) => void
}

export type SliderCore = Grip

export function createSliderCore({ begin, track, commit, cancel, onValue }: SliderCoreOptions): SliderCore {
  let press: { pointerId: number, value: number } | null = null

  function stop() {
    press = null
  }

  function abandon(pointerId?: number) {
    if (!press || (pointerId !== undefined && pointerId !== press.pointerId))
      return
    stop()
    cancel()
    onValue(null)
  }

  return {
    get holding() {
      return press !== null
    },
    press(sample) {
      if (!sample.isPrimary || sample.button !== 0)
        return false
      // 上一次没等到松开：先作废
      if (press)
        abandon()
      const value = begin(sample)
      if (value === null)
        return false
      press = { pointerId: sample.pointerId, value: clamp(value, 0, 1) }
      onValue(press.value)
      return true
    },
    move(sample) {
      if (!press || sample.pointerId !== press.pointerId)
        return
      if (pressBroken(sample.buttons))
        return abandon()
      press.value = clamp(track(sample), 0, 1)
      onValue(press.value)
    },
    release(sample) {
      if (!press || sample.pointerId !== press.pointerId)
        return
      const { value } = press
      stop()
      commit(value)
      onValue(null)
    },
    abandon,
    click() {
      return false
    },
  }
}
