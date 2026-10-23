import type { Attachment } from 'svelte/attachments'
import { getAppView } from '../app-context.svelte'
import { clamp } from '../clamp'
import { attachGrip } from '../press'
import { createSliderCore } from '../slider-core'
import { formatSeconds, shownDuration } from './view'

// 播放进度的滑块（播放页的波浪进度条、桌面底栏顶边的进度线共用）：按住拖动、点按都跳到那里，松手才跳（App.seek），
// 拖动时游标和时间跟着走；←/→（↑/↓）快退快进 5 秒，Home / End 跳到头尾。这首的长度还不知道时不能用。
// 指针怎么接（指针捕获、按住断了、作废、元素移除）交给 press.ts 的 attachGrip，值怎么变在这里（真实的 seek 在松手时提交）。

/** ←/→ 一次跳几秒 */
const STEP = 5

export interface SeekSlider {
  /** 拖动中游标停在哪（0 到 1）；没在拖时是 null */
  readonly dragging: number | null
  /** 这首有多长（秒）；还不知道时是 0 */
  readonly duration: number
  /** 游标该在哪（0 到 1）：拖动中是拖到的地方，不然是 now（放到第几秒）占这首的比例 */
  ratio: (now: number) => number
  /** 挂在 role=slider 的那个元素上：指针接线（attachGrip） */
  readonly attach: Attachment<HTMLElement>
  /** 读屏属性（游标在 ratio 处）和键盘事件 */
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

/** 在组件初始化时调用 */
export function createSeekSlider(): SeekSlider {
  const view = getAppView()
  const duration = $derived(shownDuration(view.state.player))
  let dragging = $state<number | null>(null)
  let element: HTMLElement | null = null

  /** 指针在滑块上的哪里（0 到 1）；按下时捕获了指针，拖出滑块外面也按它的左右算 */
  function ratioAt(sample: { x: number }): number | null {
    if (!element)
      return null
    const rect = element.getBoundingClientRect()
    return rect.width > 0 ? clamp((sample.x - rect.left) / rect.width, 0, 1) : 0
  }

  const core = createSliderCore({
    begin: (sample) => {
      if (duration <= 0)
        return null
      return ratioAt(sample)
    },
    track: sample => ratioAt(sample) ?? 0,
    commit: (value) => {
      // 拖动中切到一首时长还不知道的歌（duration=0）时不 seek(0)：这是有意行为变化（基线会跳回开头）
      if (duration > 0)
        view.app.seek(value * duration)
    },
    cancel: () => {},
    onValue: value => (dragging = value),
  })

  function onkeydown(event: KeyboardEvent) {
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
    ratio: now => dragging ?? (duration > 0 ? clamp(now / duration, 0, 1) : 0),
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
