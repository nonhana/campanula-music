import type { Grip } from '../shared/press'
import { pressBroken } from '../shared/press'

// 抽屉的拖动手势核心（Spec #11 的第二个测试接入点“拖动手势核心”的一半，另一半是封面转盘的 wheel-core.ts）：不碰页面、不碰 Svelte 的纯逻辑。
// 抽屉从底下升起、缩回底下，位置 0 是整个拉开，1 是收在下面看不见；开没开着由层请求说了算（settle 收的就是它）。
// 拖动来源（grip）把按下、移动、松开、点击交给它，它说抽屉跟手到哪、停在哪一头、要不要开 / 关那一层、这次算不算点按。
// 规则照主流的 Vaul（github.com/emilkowalski/vaul）：挪过起拖距离才开始拖，
// 松手时拖过自身高度的 1/4、或者整段拖动的速度超过 0.4px/ms 就去另一头，不到就回去

/** 0 整个拉开，1 收在下面看不见 */
type DrawerEnd = 0 | 1

/** 抽屉该怎么摆：拖着时跟手，不然停在层请求说的那一头（或者刚拖过去的那一头） */
export type DrawerPose
  = | { dragging: true, position: number }
    | { dragging: false, end: DrawerEnd }

export interface GripSource {
  /** 从哪一头拖：把手是拉开着往下拖（open → 收起），播放条是收着往上拖（closed → 拉开） */
  from: 'open' | 'closed'
  /** 松手时往另一头过了阈值：去开 / 关那一层（浅路由由浮层栈写） */
  commit: () => void
  /** 没拖动、只是点按（键盘的 Enter、空格也算） */
  tap?: () => void
}

export interface DrawerCore {
  readonly pose: DrawerPose
  /** 层的请求说开着 / 关了：停到那一头。正在拖时先记下，松手时没拉到另一头就去那里 */
  settle: (open: boolean) => void
  /** 一个拖动来源，每个来源一份 */
  grip: (source: GripSource) => Grip
}

export interface DrawerCoreOptions {
  /** 抽屉露出来的高度（px，不含底下垫的那一截）：把拖动的距离换成位置，1/4 也按它算 */
  size: () => number
  /** 抽屉现在画在哪（动画可能还在半路）：开始拖时从这里接着走 */
  drawnAt: () => number
  /** pose 变了 */
  onPose: (pose: DrawerPose) => void
}

/** 拖过自己高度的这么多就算数（Vaul 的 CLOSE_THRESHOLD） */
const THRESHOLD = 0.25
/** 整段拖动的速度超过这么多（px/ms）就算一甩（Vaul 的 VELOCITY_THRESHOLD） */
const FLICK = 0.4
/** 按下后挪过这么多（px）才算拖动，没挪够就是点按（Vaul：触屏 10，其他 2） */
const SLOP = { touch: 10, other: 2 }

interface Press {
  pointerId: number
  /** 按下的地方和时刻：拖过的距离、一甩的速度都从这里算（和 Vaul 一样） */
  x: number
  y: number
  time: number
  /** 开始拖的那一刻抽屉画在哪；还没挪够起拖距离时是 null */
  from: number | null
}

/** 往拉开那边拖过头 overdrag px 时只走这么多 px（Vaul 的 dampenValue：头 6px 多不动，之后按对数慢慢走） */
const dampened = (overdrag: number): number => Math.max(0, 8 * (Math.log(overdrag + 1) - 2))

/** 按下时在 at、拖过 dy px：往收起那边最多到完全收起，往拉开那边拖过头时有阻尼 */
const dragged = (at: number, dy: number, size: number): number => {
  const position = at + dy / size
  if (position > 1)
    return 1
  return position < 0
    ? 0 - dampened(-position * size) / size
    : position
}

export const createDrawerCore = ({ size, drawnAt, onPose }: DrawerCoreOptions): DrawerCore => {
  let pose: DrawerPose = { dragging: false, end: 1 }
  /** 层请求要的那一头 */
  let wanted: DrawerEnd = 1

  const setPose = (next: DrawerPose) => {
    pose = next
    onPose(next)
  }

  return {
    get pose() {
      return pose
    },
    settle(open) {
      wanted = open ? 0 : 1
      if (!pose.dragging)
        setPose({ dragging: false, end: wanted })
    },
    grip({ from, commit, tap }) {
      /** commit 后抽屉去的那一头，和往那头拖的方向（往下为 1） */
      const target: DrawerEnd = from === 'open'
        ? 1
        : 0
      const toward = target === 1
        ? 1
        : -1
      let press: Press | null = null
      /** 拖过、往横里挪开过之后，跟着来的那次指针 click 不算点按（下次按下时清掉） */
      let swallowClick = false

      const abandon = (pointerId?: number) => {
        if (!press || (pointerId !== undefined && pointerId !== press.pointerId))
          return
        const wasDragging = press.from !== null
        press = null
        swallowClick = true
        if (wasDragging)
          setPose({ dragging: false, end: wanted })
      }

      return {
        get holding() {
          return press !== null
        },
        press(sample) {
          if (!sample.isPrimary || sample.button !== 0)
            return false
          // 上一次没等到松开（松开没传到页面上）：先作废
          abandon()
          swallowClick = false
          press = {
            pointerId: sample.pointerId,
            x: sample.x,
            y: sample.y,
            time: sample.time,
            from: null,
          }
          return true
        },
        move(sample) {
          if (press?.pointerId !== sample.pointerId)
            return
          if (pressBroken(sample.buttons))
            return abandon()
          const dy = sample.y - press.y
          if (press.from === null) {
            const dx = sample.x - press.x
            if (Math.hypot(dx, dy) < (sample.pointerType === 'touch'
              ? SLOP.touch
              : SLOP.other)) {
              return
            }
            if (Math.abs(dy) < Math.abs(dx)) {
              // 先往横里挪的：不是拖抽屉，也不是点按
              press = null
              swallowClick = true
              return
            }
            // 按下后动画可能还在走：从这一刻画到的地方算起（拖过的距离仍从按下的地方算，和 Vaul 一样）
            press.from = drawnAt()
          }
          setPose({
            dragging: true,
            position: dragged(press.from, dy, size()),
          })
        },
        release(sample) {
          if (press?.pointerId !== sample.pointerId)
            return
          const ended = press
          press = null
          if (ended.from === null)
            return
          swallowClick = true
          const distance = sample.y - ended.y
          const velocity = Math.abs(distance) / Math.max(1, sample.time - ended.time)
          const far = Math.sign(distance) === toward && (velocity > FLICK || Math.abs(distance) >= size() * THRESHOLD)
          if (far && wanted !== target) {
            setPose({ dragging: false, end: target })
            commit()
          }
          else {
            setPose({ dragging: false, end: wanted })
          }
        },
        abandon,
        click(detail) {
          const swallow = swallowClick && detail > 0
          swallowClick = false
          if (!swallow)
            tap?.()
          return swallow
        },
      }
    },
  }
}
