import type { Attachment } from 'svelte/attachments'

import { getAppView } from '../shared/app-context.svelte'
import { clamp } from '../shared/clamp'
import { attachGrip } from '../shared/press'
import { createSliderCore } from '../shared/slider-core'
import { shownDuration } from './now'
import { formatSeconds } from './view'

// 播放进度滑块（播放页波浪进度条、桌面底栏进度线共用）：拖动、点按都跳到那里，松手才 seek，拖动时游标和时间跟着走；
// ←/→（↑/↓）快退快进 5 秒，Home / End 到头尾。长度还不知道时不能用。指针接线交给 press.ts 的 attachGrip。

const STEP = 5

export interface SeekSlider {
  readonly dragging: number | null
  readonly duration: number
  /** 拖动中是拖到的地方，不然是 now 占这首的比例 */
  ratio: (now: number) => number
  readonly attach: Attachment<HTMLElement>
  /** 游标在 ratio 处 */
  attributes: (ratio: number) => SliderAttributes
}

interface SliderAttributes {
  'role': 'slider'
  'tabindex': 0
  'aria-label': string
  'aria-valuemin': number
  'aria-valuemax': number
  'aria-valuenow': number
  'aria-valuetext': string
  'aria-disabled': boolean
  'onkeydown': (event: KeyboardEvent) => void
}

export const createSeekSlider = (): SeekSlider => {
  const view = getAppView()
  const duration = $derived(shownDuration(view.state.player))
  let dragging = $state<number | null>(null)
  let element: HTMLElement | null = null

  /** 按下时捕获指针，拖出滑块也按它的左右算 */
  const ratioAt = (sample: { x: number }): number | null => {
    if (!element)
      return null
    const rect = element.getBoundingClientRect()
    return rect.width > 0
? clamp((sample.x - rect.left) / rect.width, 0, 1)
: 0
  }

  const core = createSliderCore({
    begin: (sample) => {
      if (duration <= 0)
        return null
      return ratioAt(sample)
    },
    track: sample => ratioAt(sample) ?? 0,
    commit: (value) => {
      // 拖动中切到时长还不知道的歌（duration=0）时不 seek(0)：有意行为变化（基线会跳回开头）
      if (duration > 0)
        view.app.seek(value * duration)
    },
    cancel: () => {},
    onValue: value => (dragging = value),
  })

  const onkeydown = (event: KeyboardEvent) => {
    if (duration <= 0)
      return
    const at = view.state.player.position
    const to = {
      ArrowRight: at + STEP,
      ArrowUp: at + STEP,
      ArrowLeft: at - STEP,
      ArrowDown: at - STEP,
      Home: 0,
      End: duration,
    }[event.key]
    if (to === undefined)
      return
    event.preventDefault()
    view.app.seek(to)
  }

  return {
    get dragging() {
      return dragging
    },
    get duration() {
      return duration
    },
    ratio: now => dragging ?? (duration > 0
? clamp(now / duration, 0, 1)
: 0),
    attach: (node) => {
      element = node
      const detach = attachGrip(core)(node)
      return () => {
        if (element === node)
          element = null
        detach?.()
      }
    },
    attributes(ratio) {
      const shown = ratio * duration
      return {
        'role': 'slider',
        'tabindex': 0,
        'aria-label': '播放进度',
        'aria-valuemin': 0,
        'aria-valuemax': Math.round(duration),
        'aria-valuenow': Math.round(shown),
        'aria-valuetext': `${formatSeconds(shown)} / ${formatSeconds(duration)}`,
        'aria-disabled': duration <= 0,
        onkeydown,
      }
    },
  }
}
