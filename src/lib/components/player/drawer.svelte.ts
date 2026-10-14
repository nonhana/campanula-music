import { untrack } from 'svelte'
import { quartOut } from 'svelte/easing'
import { prefersReducedMotion, Tween } from 'svelte/motion'

// 从底下升起、缩回底下的抽屉（播放页、手机的播放队列弹层），按自己的高度滑：位置 0 是整个拉开，1 是收在下面看不见。
// 开没开着由浅路由说了算（settle）。拖动把手、播放条时跟着手走；松手时从按下的地方拖过自己高度的 1/4、或者往一个方向一甩，
// 就拉开或收起（改浅路由），不到就回到浅路由说的那一头（拖着时按了 Esc、返回，松手就收起）。
// 整段动画 380ms，中途松手按剩下的距离算；减少动态效果时直接到位

/** 从收着到整个拉开的时长 */
const FULL_MS = 380
/** 拖过自己高度的这么多就算数 */
const THRESHOLD = 0.25
/** 松手时这么快（px/ms，即每秒 1000px）就算一甩：往哪甩就去哪。普通的快拖不到这么快，照拖过的距离算 */
const FLICK = 1
/** 按下后挪过这么多（px）才算拖动，没挪够就是点按 */
const SLOP = 6
/** 用松手前这么久（ms）的移动算速度 */
const VELOCITY_WINDOW_MS = 80

export interface DragSource {
  /** 这个来源往哪拉：把手是拉开着往下拖（open → 收起），播放条是收着往上拖（closed → 拉开） */
  from: 'open' | 'closed'
  /** 松手时往另一头过了阈值：改浅路由去另一头 */
  commit: () => void
  /** 没拖动、只是点按（键盘的 Enter、空格也算） */
  tap?: () => void
}

/** 拖动来源上要挂的事件，展开到元素上；元素要有 touch-none，手机上才不会被当成滚动 */
export interface GrabHandlers {
  onpointerdown: (event: PointerEvent) => void
  onpointermove: (event: PointerEvent) => void
  onpointerup: (event: PointerEvent) => void
  onpointercancel: (event: PointerEvent) => void
  onclick?: (event: MouseEvent) => void
}

export interface Drawer {
  /** 0 整个拉开，1 收在下面看不见 */
  readonly position: number
  /** 没完全收起（拉开着、正在动、正在拖）：要画出来 */
  readonly visible: boolean
  /** 浅路由说开着 / 关了：动到那一头。正在拖时先记下，松手时没拉到另一头就去那里 */
  settle: (open: boolean) => void
  /** 一个拖动来源的事件；在组件初始化时调用，每个来源一份 */
  grab: (source: DragSource) => GrabHandlers
}

interface Gesture {
  id: number
  x: number
  y: number
  /** 开始拖时抽屉在哪（拖动从这里算起） */
  start: number
  moved: boolean
  samples: { y: number, t: number }[]
}

/** height：抽屉自己的高度（px），把拖动的距离换成位置 */
export function createDrawer(height: () => number): Drawer {
  const position = new Tween(1, {
    duration: (from, to) => (prefersReducedMotion.current ? 0 : Math.max(120, FULL_MS * Math.abs(to - from))),
    easing: quartOut,
  })
  let dragging = false
  /** 浅路由要的那一头 */
  let wanted: 0 | 1 = 1

  /** 拖着时整页不选字，光标是抓着的手 */
  function holdPage(held: boolean) {
    const { style } = document.documentElement
    style.cursor = held ? 'grabbing' : ''
    style.userSelect = held ? 'none' : ''
  }

  function moveTo(end: 0 | 1) {
    // 不跟着 target 变：调用它的 effect 只该跟着浅路由走，松手时自己定的去向不能被它拉回去
    if (untrack(() => position.target) !== end)
      void position.set(end)
  }

  return {
    get position() {
      return position.current
    },
    get visible() {
      return position.current < 1
    },
    settle(open) {
      wanted = open ? 0 : 1
      if (!dragging)
        moveTo(wanted)
    },
    grab({ from, commit, tap }) {
      /** commit 后抽屉去的那一头，和往那头拖的方向（往下为 1） */
      const target = from === 'open' ? 1 : 0
      const commitDirection = target === 1 ? 1 : -1
      let gesture: Gesture | null = null
      /** 刚拖完、或者按下后往横里挪开了：跟着来的那次指针 click 不算点按 */
      let swallowClick = false

      function release(event: PointerEvent, cancelled: boolean) {
        if (gesture?.id !== event.pointerId)
          return
        const { moved, start, samples } = gesture
        gesture = null
        if (!moved)
          return
        // 指针被取消时不会再有 click
        swallowClick = !cancelled
        dragging = false
        holdPage(false)
        const recent = samples.filter(sample => event.timeStamp - sample.t <= VELOCITY_WINDOW_MS)
        const first = recent[0]
        const last = recent.at(-1)
        /** 往下为正 */
        const velocity = first && last && last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0
        const travelled = position.current - start
        /** 往下（收起）为 1，往上（拉开）为 -1，没拉到为 0 */
        const toward = cancelled ? 0 : Math.abs(velocity) >= FLICK ? Math.sign(velocity) : Math.abs(travelled) >= THRESHOLD ? Math.sign(travelled) : 0
        if (toward === commitDirection && wanted !== target) {
          moveTo(target)
          commit()
        }
        else {
          moveTo(wanted)
        }
      }

      return {
        onpointerdown(event) {
          if (!event.isPrimary || event.button !== 0)
            return
          swallowClick = false
          gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, start: 0, moved: false, samples: [] }
          ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
        },
        onpointermove(event) {
          if (gesture?.id !== event.pointerId)
            return
          const dy = event.clientY - gesture.y
          if (!gesture.moved) {
            const dx = event.clientX - gesture.x
            if (Math.hypot(dx, dy) < SLOP)
              return
            if (Math.abs(dy) < Math.abs(dx)) {
              // 先往横里挪的：不是拖抽屉，也不是点按
              gesture = null
              swallowClick = true
              return
            }
            gesture.moved = true
            // 从现在的位置接着走（按下后还在动画的，不跳回按下时的位置）
            gesture.start = position.current - dy / height()
            dragging = true
            holdPage(true)
          }
          void position.set(Math.min(1, Math.max(0, gesture.start + dy / height())), { duration: 0 })
          gesture.samples = [...gesture.samples.filter(sample => event.timeStamp - sample.t <= VELOCITY_WINDOW_MS), { y: event.clientY, t: event.timeStamp }]
        },
        onpointerup: event => release(event, false),
        onpointercancel: event => release(event, true),
        ...(tap && {
          onclick(event: MouseEvent) {
            // 键盘按出来的 click（detail 是 0）一定算点按
            const swallow = swallowClick && event.detail > 0
            swallowClick = false
            if (!swallow)
              tap()
          },
        }),
      }
    },
  }
}
