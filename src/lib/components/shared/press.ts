import type { Attachment } from 'svelte/attachments'

// 按住拖动（抽屉、封面转盘、进度滑块、滚动条滑块）时，松开可能传不到页面：点右键（菜单吞掉松开）、切走窗口、页面藏起来、
// 浏览器收回指针捕获。这时拖动要马上作废，不然光标一直抓着、抽屉卡在半路、页面点不动。各手势核心给出统一的 Grip，
// 由 attachGrip / attachWindowGrip 接浏览器；click 只在 grip.click(detail) 返回 true 时吞掉（guard 认领的 click 也走这一处）。

/** 拖着时按下右键，浏览器先报按住断了，菜单随后才来（Windows 上要等右键松开） */
const MENU_GRACE_MS = 300
/** click 紧跟 pointerup，挡太久会吞掉紧接着的下一次点按 */
const CLICK_GRACE_MS = 80

/** PointerEvent.buttons 说明按住断了：主键（左键、手指、笔尖）没按着，或者又按下了右键 */
export const pressBroken = (buttons: number): boolean => (buttons & 1) === 0 || (buttons & 2) !== 0

/** 右键菜单、窗口失焦、页面藏起来时 abandon；触屏长按的菜单只挡掉、不作废。返回停止函数，停止后再挡 300ms 菜单 */
const watchPress = (abandon: () => void): () => void => {
  let ended = false
  const oncontextmenu = (event: Event) => {
    event.preventDefault()
    if (!ended && !(event instanceof PointerEvent && event.pointerType === 'touch'))
      abandon()
  }
  const onvisibilitychange = () => {
    if (document.visibilityState === 'hidden')
      abandon()
  }
  window.addEventListener('contextmenu', oncontextmenu, true)
  window.addEventListener('blur', abandon)
  document.addEventListener('visibilitychange', onvisibilitychange)
  return () => {
    ended = true
    window.removeEventListener('blur', abandon)
    document.removeEventListener('visibilitychange', onvisibilitychange)
    setTimeout(() => window.removeEventListener('contextmenu', oncontextmenu, true), MENU_GRACE_MS)
  }
}

export interface PointerSample {
  pointerId: number
  pointerType: string
  isPrimary: boolean
  button: number
  /** 1 主键，2 右键 */
  buttons: number
  x: number
  y: number
  target?: EventTarget | null
  /** 毫秒（event.timeStamp） */
  time: number
}

export interface Grip {
  /** 认了的那次按下还没结束 */
  readonly holding: boolean
  /** 只认主指针的主键；上一次没等到松开的先作废 */
  press: (sample: PointerSample) => boolean
  /** 别的指针不管；按住断了就作废 */
  move: (sample: PointerSample) => void
  release: (sample: PointerSample) => void
  /** 作废，拖着的回到原处，跟着来的 click 不算点按；给了 pointerId 时只管这根指针，不给就是这次按住 */
  abandon: (pointerId?: number) => void
  /** detail 照抄 MouseEvent.detail（键盘按出来的是 0）；返回 true = 吞掉这一下 */
  click: (detail: number) => boolean
}

/** 拖着时整页不选字、光标是抓着的手；每个手势核心一份，只放开自己按住的（别的抽屉停到一头时不会放开正在拖的这个） */
export const createPageHold = (): (hold: boolean) => void => {
  let held = false
  return (hold) => {
    if (hold === held)
      return
    held = hold
    const { style } = document.documentElement
    style.cursor = hold ? 'grabbing' : ''
    style.userSelect = hold ? 'none' : ''
  }
}

/** 按下时捕获指针、盯着按住断没断；pointercancel、捕获被收回、元素被拿掉都作废这根指针。元素设 touch-action: none，click 也交给 grip */
export const attachGrip = (grip: Grip, { touchAction = true }: { touchAction?: boolean } = {}): Attachment<HTMLElement> => (element) => {
  let unwatch: (() => void) | null = null
  const settleWatch = () => {
    if (grip.holding)
      return
    unwatch?.()
    unwatch = null
  }
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
    target: event.target,
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
    click: (event: MouseEvent) => {
      if (!grip.click(event.detail))
        return
      event.preventDefault()
      event.stopPropagation()
    },
  }
  if (touchAction)
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

/** 和 attachGrip 一样，但 move / up / cancel 听在 window 上、不设 pointer capture，给会被虚拟列表重建的把手用；元素被拿掉时不会作废这次按住 */
export const attachWindowGrip = (grip: Grip): Attachment<HTMLElement> => (element) => {
  let stop: (() => void) | null = null
  let activePointer: number | null = null
  let swallowClick = false
  let clickTimer: ReturnType<typeof setTimeout> | undefined
  /** 只挡这一下跟来的 click，不吞掉别处紧接着的点按 */
  let clickAt = { x: 0, y: 0 }
  const sample = (event: PointerEvent): PointerSample => ({
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    button: event.button,
    buttons: event.buttons,
    x: event.clientX,
    y: event.clientY,
    time: event.timeStamp,
    target: event.target,
  })
  const onClick = (event: MouseEvent) => {
    if (!swallowClick || event.detail === 0)
      return
    if (Math.abs(event.clientX - clickAt.x) > 6 || Math.abs(event.clientY - clickAt.y) > 6)
      return
    swallowClick = false
    clearTimeout(clickTimer)
    window.removeEventListener('click', onClick, true)
    if (!grip.click(event.detail))
      return
    event.preventDefault()
    event.stopPropagation()
  }
  const pointerdown = (event: PointerEvent) => {
    const accepted = sample(event)
    if (!grip.press(accepted))
      return
    activePointer = event.pointerId
    clearTimeout(clickTimer)
    let end: () => void = () => {}
    const move = (e: PointerEvent) => {
      if (e.pointerId !== activePointer)
        return
      // 鼠标按住断了（主键松开、又按了右键）或没等到松开：作废，不能提交
      if (pressBroken(e.buttons)) {
        grip.abandon(activePointer)
        end()
        return
      }
      grip.move(sample(e))
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== activePointer)
        return
      if (e.button !== 0) {
        grip.abandon(activePointer)
        end()
        return
      }
      clickAt = { x: e.clientX, y: e.clientY }
      grip.release(sample(e))
      end()
    }
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== activePointer)
        return
      grip.abandon(activePointer)
      end()
    }
    // 鼠标拖出窗口后松开：按住断了，收掉监听；还按着（例如自动滚动拖到窗口外）不动
    const leave = (e: PointerEvent) => {
      if (e.pointerId !== activePointer || e.pointerType !== 'mouse' || !pressBroken(e.buttons))
        return
      grip.abandon(activePointer)
      end()
    }
    const unwatch = watchPress(() => {
      grip.abandon()
      end()
    })
    end = () => {
      if (!stop)
        return
      stop = null
      activePointer = null
      unwatch()
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel, true)
      document.documentElement.removeEventListener('pointerleave', leave, true)
      // 松手后跟着来的 click 不算点按：等它来，或者最多挡一小会儿
      clearTimeout(clickTimer)
      clickTimer = setTimeout(() => {
        swallowClick = false
        window.removeEventListener('click', onClick, true)
      }, CLICK_GRACE_MS)
    }
    stop = end
    swallowClick = true
    window.addEventListener('click', onClick, true)
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', cancel, true)
    document.documentElement.addEventListener('pointerleave', leave, true)
  }
  element.addEventListener('pointerdown', pointerdown)
  element.style.touchAction = 'none'
  return () => {
    element.removeEventListener('pointerdown', pointerdown)
  // 不主动停 window 监听：拖动中元素被重建时，这次按住要接着走
  }
}
