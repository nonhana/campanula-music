import type { Attachment } from 'svelte/attachments'

// 按住拖动（播放页抽屉、手机播放页的封面转盘、进度滑块、自绘滚动条的滑块）时，松开的那一下可能根本传不到页面上：拖着时点了右键（弹出的菜单吞掉了松开）、
// 切走了窗口、页面被藏起来、浏览器收回了指针捕获。这时候拖动要马上作废，不然光标一直是抓着的手、抽屉卡在半路、页面点不动。
// 抽屉和转盘的拖动怎么判断各在一个纯逻辑的手势核心里（drawer-core.ts、wheel-core.ts），它们给出一样的拖动来源（Grip），由 attachGrip 接上浏览器

/** 按住结束后还挡多久右键菜单：拖着时按下右键，浏览器先报按住断了，菜单随后才来（Windows 上要等右键松开） */
const MENU_GRACE_MS = 300

/** 拖动中移动时的 buttons（PointerEvent.buttons）说明按住已经断了：主键（鼠标左键、手指、笔尖）没按着了，或者又按下了右键 */
export function pressBroken(buttons: number): boolean {
  return (buttons & 1) === 0 || (buttons & 2) !== 0
}

/**
 * 按下后开始盯着：要弹出右键菜单（不让它弹）、窗口失去焦点、页面藏起来时调用 abandon。
 * 触屏上按着不动也会报一次菜单（长按），按住并没有断：只挡掉菜单，不调用 abandon。
 * 返回停止盯着的函数，拖动结束、作废时都要调用；停止后再挡 300ms 右键菜单，然后才放开
 */
export function watchPress(abandon: () => void): () => void {
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

/** 一次指针事件里用得到的部分（PointerEvent 照抄过来） */
export interface PointerSample {
  pointerId: number
  pointerType: string
  isPrimary: boolean
  /** 按下的是哪个键（0 主键） */
  button: number
  /** 现在按着哪些键（1 主键，2 右键） */
  buttons: number
  x: number
  y: number
  /** 毫秒（event.timeStamp） */
  time: number
}

/** 一个拖动来源：把它收到的指针事件、点击原样交过来 */
export interface Grip {
  /** 正按着（认了的那次按下还没结束）：这时候才要捕获指针、盯着按住断没断 */
  readonly holding: boolean
  /** 按下：只认主指针（第一根手指）的主键；上一次没等到松开的先作废。返回认不认这次按下 */
  press: (sample: PointerSample) => boolean
  /** 移动：别的指针的不管；发现按住断了（主键松开了、又按了右键）就作废 */
  move: (sample: PointerSample) => void
  /** 松开：别的指针（第二根手指）的不管 */
  release: (sample: PointerSample) => void
  /**
   * 按住断了：作废，拖着的回到原处，跟着来的 click 不算点按。
   * 给了 pointerId（pointercancel、指针捕获被收回）时只管这根指针；不给（右键菜单、切走窗口、页面藏起来）就是这次按住
   */
  abandon: (pointerId?: number) => void
  /** 松开之后跟着来的 click；detail 照抄 MouseEvent.detail（键盘按出来的是 0） */
  click: (detail: number) => void
}

/**
 * 拖着时整页不选字，光标是抓着的手：`const holdPage = createPageHold()`，拖动开始时 holdPage(true)，结束时 holdPage(false)。
 * 每个手势核心一份，只放开自己按住的（别的抽屉停到一头时不会放开正在拖的这个）
 */
export function createPageHold(): (hold: boolean) => void {
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

/**
 * 把元素变成拖动来源：`{@attach attachGrip(grip)}`。按下时捕获指针、盯着按住断没断（watchPress），
 * pointercancel、指针捕获被收回时作废这根指针；元素没了（拖着时被拿掉）也作废。
 * 元素自己设上 touch-action: none（手机上拖动不被当成滚动）；点按（click）也交给 grip，不用再写 onclick
 */
export function attachGrip(grip: Grip): Attachment<HTMLElement> {
  return (element) => {
    /** 停止盯着这次按住；没按着时是 null */
    let unwatch: (() => void) | null = null
    /** 这次按住结束了（松开、作废、按住断了）就不再盯着 */
    const settleWatch = () => {
      if (grip.holding)
        return
      unwatch?.()
      unwatch = null
    }
    /** 右键菜单、切走窗口、页面藏起来：这次按住作废 */
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
      click: (event: MouseEvent) => grip.click(event.detail),
    }
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
}
