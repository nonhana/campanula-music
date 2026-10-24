import { clamp } from './clamp'
import type { Grip, PointerSample } from './press'
import { pressBroken } from './press'

// 线性拖动核心（进度条、滚动条滑块共用；Spec #11 第二个测试接入点）：不碰页面、不碰 Svelte。按下把指针位置换成 0–1，拖动跟着走、
// 松手才提交；只认主指针主键，第二根手指不插手；按住断了（右键、切走窗口、指针被收回）作废，不提交。

export interface SliderCoreOptions {
  /** 返回这一刻的值；null 是这次按下不接（例如点在滑块前后的空白处） */
  begin: (sample: PointerSample) => number | null
  track: (sample: PointerSample) => number
  commit: (value: number) => void
  cancel: () => void
  onValue: (value: number | null) => void
}

export type SliderCore = Grip

export const createSliderCore = ({ begin, track, commit, cancel, onValue }: SliderCoreOptions): SliderCore => {
  let press: { pointerId: number, value: number } | null = null

  const stop = () => {
    press = null
  }

  const abandon = (pointerId?: number) => {
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
      press = {
        pointerId: sample.pointerId,
        value: clamp(value, 0, 1),
      }
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
