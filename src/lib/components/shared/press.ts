import type { Attachment } from 'svelte/attachments'

// 所有按住拖动（抽屉、封面转盘、进度滑块、滚动条滑块、拖动排序、横向架子、封面取景框）共用一套规矩：松开才算松手，照常提交；
// pointercancel 是作废（和 Motion、dnd-kit、react-aria、Embla 一样，都不拿移动时的 buttons 判断松没松手）。点右键（菜单吞掉松开）、切走窗口、
// 页面藏起来时松开传不到页面，这次拖动作废，不然光标一直抓着、抽屉卡在半路、页面点不动。各手势核心给出统一的 Grip，
// 由 attachGrip / attachWindowGrip 接浏览器（按下就接手）；滚动条的触屏快速定位用 attachTouchClaim（点按穿过去，上下拖了才接手）。
// click 只在 grip.click(detail) 返回 true 时吞掉（guard 认领的 click 也走这一处）；attachTouchClaim 接手以后的 click 一律吞掉。

/** 拖着时按下右键，移动先报右键按下了，菜单随后才来（Windows 上要等右键松开） */
const MENU_GRACE_MS = 300
/** click 紧跟 pointerup，挡太久会吞掉紧接着的下一次点按 */
const CLICK_GRACE_MS = 80
/** 手指挪过这么多（px）才决定接不接：要比浏览器自己开始滚的距离（Android 上约 8px）短，不然页面先滚起来，这次按下被 pointercancel 收走 */
const CLAIM_SLOP = 6

/**
 * 按住拖动时又按下了右键（PointerEvent.buttons 的第 2 位；规范里这时发的是 pointermove，不是 pointerdown）：菜单随后就来，这次拖动作废。
 * 主键那一位不看：Mac 上的 Chrome 用 [NSEvent pressedMouseButtons] 填 buttons（Chromium components/input/web_input_event_builders_mac.mm），
 * 是事件转换那一刻的真实键位，快速松手时 pointerup 之前会先来一次 buttons 为 0 的移动，那时这次拖动还没结束
 */
export const rightButtonDown = (buttons: number): boolean => (buttons & 2) !== 0

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
  /** 别的指针不管；又按下了右键就作废 */
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

/** 按下时捕获指针、盯着按住断没断；pointercancel、元素被拿掉作废这根指针，浏览器自己收回捕获算松手。元素设 touch-action: none，click 也交给 grip；按住时拦掉浏览器的拖出去 */
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
    // 只管这根指针：第二根手指被取消不影响正在拖的这次
    pointercancel(event: PointerEvent) {
      grip.abandon(event.pointerId)
      settleWatch()
    },
    // 浏览器自己收回捕获：Chromium 在移动时发现键已经松开就收回（pointer_event_manager.cc：“for when the mouse is released outside of the page”），
    // Mac 上快速松手时它就在 pointerup 之前这样做。也就是听众已经松手了：在这里松手、照常提交。正常松开以后的那次收回，这次按住早已结束，不再管
    lostpointercapture(event: PointerEvent) {
      grip.release(sample(event))
      settleWatch()
    },
    click: (event: MouseEvent) => {
      if (!grip.click(event.detail))
        return
      event.preventDefault()
      event.stopPropagation()
    },
    // 按住时浏览器想把链接、图片拖出去：拦掉，不然它发 pointercancel 叫停这次拖动（dnd-kit 同样只在按住期间拦）
    dragstart(event: DragEvent) {
      if (grip.holding)
        event.preventDefault()
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

/** 和 attachGrip 一样，但 move / up / cancel 听在 window 上、不设 pointer capture，给会被虚拟列表重建的把手、里面还有链接和按钮要点的区域用；元素被拿掉时不会作废这次按住 */
export const attachWindowGrip = (grip: Grip, { touchAction = true }: { touchAction?: boolean } = {}): Attachment<HTMLElement> => (element) => {
  let stop: (() => void) | null = null
  let activePointer: number | null = null
  let swallowClick = false
  let clickTimer: ReturnType<typeof setTimeout> | undefined
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
  // 松手跟着来的 click 交给 grip：松手的地方可能已经不在这块区域里（虚拟列表重建、拖到别处松开），所以听在 window 上。
  // 不比位置：快速松手时 click 离最后一次移动可能很远（和 Embla、dnd-kit 一样，只认这次按住之后来的那一下 click）
  const onClick = (event: MouseEvent) => {
    if (!swallowClick || event.detail === 0)
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
      // 又按下了右键：作废，不能提交。主键那一位不看（rightButtonDown 的说明）
      if (rightButtonDown(e.buttons)) {
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
      grip.release(sample(e))
      end()
    }
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== activePointer)
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
  }
  // 按住时浏览器想把链接、图片拖出去：拦掉，不然它发 pointercancel 叫停这次拖动（dnd-kit 同样只在按住期间拦）
  const ondragstart = (event: DragEvent) => {
    if (grip.holding)
      event.preventDefault()
  }
  element.addEventListener('pointerdown', pointerdown)
  element.addEventListener('dragstart', ondragstart)
  if (touchAction)
    element.style.touchAction = 'none'
  return () => {
    element.removeEventListener('pointerdown', pointerdown)
    element.removeEventListener('dragstart', ondragstart)
  // 不主动停 window 监听：拖动中元素被重建时，这次按住要接着走
  }
}

/** 手指按在 attachTouchClaim 那块里以后的一次移动：wait 还没挪够（点按、长按照常落到下面），claim 接手，pass 交还浏览器 */
export type TouchClaim = 'wait' | 'claim' | 'pass'

/** 挪够了、上下比左右挪得多、这一下还拦得住（浏览器没开始滚）才接手；横着挪的（横向架子、系统的返回手势）交还浏览器 */
export const touchClaim = (from: { x: number, y: number }, at: { x: number, y: number }, cancelable: boolean): TouchClaim => {
  const dx = at.x - from.x
  const dy = at.y - from.y
  if (Math.hypot(dx, dy) < CLAIM_SLOP)
    return 'wait'
  return cancelable && Math.abs(dy) > Math.abs(dx)
    ? 'claim'
    : 'pass'
}

/**
 * 触屏上点按穿过去、上下拖了才接手（自绘滚动条的快速定位，DESIGN.md Scrollbar · 触屏）：挂在一块看不见、不接指针的区域上（pointer-events: none），
 * 手指按在它范围里、它又在最上层（上面没盖着浮层、菜单）时，点按、长按照常落到下面的按钮和行上；挪够了、上下为主（touchClaim）才把这次按下交给 grip
 * （按下那一刻的样本，target 是这块区域），拦掉这次的页面滚动。松手跟着来的 click 一律吞掉：这次按住是这块区域的，不是下面那个按钮的。
 * 只接手指，两根手指的手势交给浏览器。
 * 接手以后的移动、松开听在手指按下的那个元素上：快速定位时虚拟列表会把它拿掉，拿掉以后 touch 事件照样发给它，只是冒不到 window
 * （Android 上手指底下的元素被卸载后，听在 window 上的就断了，song-drag.svelte.ts 同样因此一直保留被拖的行）。
 * 拦页面滚动只能在 touchmove 上 preventDefault，非被动的 touchmove 监听会让每次手指开始滑动前先等页面脚本，所以调用方只在能拖时挂上；卸下时正在拖的作废。
 */
export const attachTouchClaim = (grip: Grip): Attachment<HTMLElement> => (element) => {
  /** 按在这块里、还没决定的那根手指 */
  let pending: { from: PointerSample, id: number } | null = null
  /** 接手以后：拆掉手指下那个元素上的监听、停止盯着按住断没断；没在拖时是 null */
  let release: (() => void) | null = null
  let swallowClick = false
  let clickTimer: ReturnType<typeof setTimeout> | undefined

  const sample = (touch: Touch, time: number): PointerSample => ({
    pointerId: touch.identifier,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 1,
    x: touch.clientX,
    y: touch.clientY,
    time,
    target: element,
  })
  /** 松手、作废以后：跟着来的 click 不算点按，等它来，或者最多挡一小会儿 */
  const end = () => {
    release?.()
    release = null
    swallowClick = true
    clearTimeout(clickTimer)
    clickTimer = setTimeout(() => (swallowClick = false), CLICK_GRACE_MS)
  }

  /** 接手：后面的移动、松开、取消都听在手指按下的那个元素上 */
  const claim = (target: EventTarget, id: number) => {
    const mine = (event: Event): Touch | undefined => [...(event as TouchEvent).changedTouches].find(touch => touch.identifier === id)
    const onmove = (event: Event) => {
      const touch = mine(event)
      if (!touch)
        return
      if (event.cancelable)
        event.preventDefault()
      grip.move(sample(touch, event.timeStamp))
    }
    const onend = (event: Event) => {
      const touch = mine(event)
      if (!touch)
        return
      grip.release(sample(touch, event.timeStamp))
      end()
    }
    const oncancel = (event: Event) => {
      if (!mine(event))
        return
      grip.abandon()
      end()
    }
    target.addEventListener('touchmove', onmove, { passive: false })
    target.addEventListener('touchend', onend)
    target.addEventListener('touchcancel', oncancel)
    const unwatch = watchPress(() => {
      grip.abandon()
      end()
    })
    release = () => {
      target.removeEventListener('touchmove', onmove)
      target.removeEventListener('touchend', onend)
      target.removeEventListener('touchcancel', oncancel)
      unwatch()
    }
  }

  // 第二根手指按下：两指的手势交给浏览器；已经在拖的照旧（grip 只认主指针）
  const ontouchstart = (event: TouchEvent) => {
    pending = null
    const touch = event.changedTouches[0]
    if (release !== null || event.touches.length !== 1 || !touch)
      return
    // 按层叠判断按没按在这块上，和它自己接指针时一样：上面盖着浮层、菜单的地方不算。只在这一下让它能被点中
    element.style.pointerEvents = 'auto'
    const top = document.elementFromPoint(touch.clientX, touch.clientY)
    element.style.pointerEvents = ''
    if (top === element) {
      pending = {
        from: sample(touch, event.timeStamp),
        id: touch.identifier,
      }
    }
  }
  const ontouchmove = (event: TouchEvent) => {
    if (!pending)
      return
    const { from, id } = pending
    const touch = [...event.touches].find(item => item.identifier === id)
    if (!touch)
      return
    const decision = touchClaim(from, { x: touch.clientX, y: touch.clientY }, event.cancelable)
    if (decision === 'wait')
      return
    pending = null
    if (decision === 'pass' || !grip.press(from))
      return
    event.preventDefault()
    claim(touch.target, id)
    grip.move(sample(touch, event.timeStamp))
  }
  const onclick = (event: MouseEvent) => {
    if (!swallowClick || event.detail === 0)
      return
    swallowClick = false
    clearTimeout(clickTimer)
    event.preventDefault()
    event.stopPropagation()
  }
  window.addEventListener('touchstart', ontouchstart, { capture: true, passive: true })
  window.addEventListener('touchmove', ontouchmove, { capture: true, passive: false })
  window.addEventListener('click', onclick, true)
  return () => {
    window.removeEventListener('touchstart', ontouchstart, true)
    window.removeEventListener('touchmove', ontouchmove, true)
    window.removeEventListener('click', onclick, true)
    clearTimeout(clickTimer)
    // 拖着时不能拖了（列表变短、进了多选）：作废
    if (release !== null) {
      grip.abandon()
      release()
      release = null
    }
  }
}
