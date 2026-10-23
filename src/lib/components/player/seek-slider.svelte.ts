import { getAppView } from '../app-context.svelte'
import { pressBroken, watchPress } from '../press'
import { formatSeconds, shownDuration } from './view'

// 播放进度的滑块（播放页的波浪进度条、桌面底栏顶边的进度线共用）：按住拖动、点按都跳到那里，松手才跳（App.seek），
// 拖动时游标和时间跟着走；←/→（↑/↓）快退快进 5 秒，Home / End 跳到头尾。这首的长度还不知道时不能用。
// 按住断了（右键菜单、切走窗口、页面藏起来、指针捕获被收回、移动时按键已经松开）就作废，不跳

/** ←/→ 一次跳几秒 */
const STEP = 5

export interface SeekSlider {
  /** 拖动中游标停在哪（0 到 1）；没在拖时是 null */
  readonly dragging: number | null
  /** 这首有多长（秒）；还不知道时是 0 */
  readonly duration: number
  /** 游标该在哪（0 到 1）：拖动中是拖到的地方，不然是 now（放到第几秒）占这首的比例 */
  ratio: (now: number) => number
  /** 挂在 role=slider 的那个元素上：读屏属性（游标在 ratio 处）和指针、键盘事件 */
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
  'onpointerdown': (event: PointerEvent) => void
  'onpointermove': (event: PointerEvent) => void
  'onpointerup': () => void
  'onpointercancel': () => void
  'onlostpointercapture': () => void
  'onkeydown': (event: KeyboardEvent) => void
}

/** 在组件初始化时调用 */
export function createSeekSlider(): SeekSlider {
  const view = getAppView()
  const duration = $derived(shownDuration(view.state.player))
  let dragging = $state<number | null>(null)
  /** 停止盯着这次按住（press.ts）；没按着时是 null */
  let unwatch: (() => void) | null = null

  /** 指针在滑块上的哪里（0 到 1）；按下时捕获了指针，拖出滑块外面也按它的左右算 */
  function ratioAt(event: PointerEvent): number {
    const rect = (event.currentTarget as Element).getBoundingClientRect()
    return rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0
  }

  /** 按住结束或作废：不再盯着，游标回到播放进度 */
  function finish() {
    dragging = null
    unwatch?.()
    unwatch = null
  }

  function onpointerdown(event: PointerEvent) {
    if (duration <= 0 || event.button !== 0)
      return
    finish()
    const target = event.currentTarget as Element
    target.setPointerCapture(event.pointerId)
    dragging = ratioAt(event)
    unwatch = watchPress(finish)
  }

  function onpointermove(event: PointerEvent) {
    if (dragging === null)
      return
    if (pressBroken(event.buttons))
      return finish()
    dragging = ratioAt(event)
  }

  function onpointerup() {
    if (dragging === null)
      return
    view.app.seek(dragging * duration)
    finish()
  }

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
    ratio: now => dragging ?? (duration > 0 ? Math.min(1, Math.max(0, now / duration)) : 0),
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
        onpointerdown,
        onpointermove,
        onpointerup,
        'onpointercancel': finish,
        'onlostpointercapture': finish,
        onkeydown,
      }
    },
  }
}
