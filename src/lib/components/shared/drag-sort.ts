import type { Grip, PointerSample } from './press'
import { clamp } from './clamp'
import { pressBroken } from './press'
import { edgeScroll } from './scroll-edge'

// 拖动排序的手势核心（Spec #11 的第二个测试接入点“拖动手势核心”；和 drawer-core、wheel-core 同一处）：
// 不碰页面、不碰 Svelte 的纯逻辑。三个排序器（手机歌单行、桌面歌单网格、多选拖歌）共用这里的按下协议、
// 目标空位、预览顺序、放下提交、作废撤回、边缘滚动和 Alt + ↑ / ↓；几何适配器只量 DOM，影子由视图画。
// 按下：只认主指针的主键；鼠标挪过 5px 才算拖，触屏按住立即开始。上一次没等到松开就再按（打断过）时，
// 先把那一次清干净——不然会拿旧的“还没挪够 5px”接着判断，拖到一半就再也结束不了。

/** 视口坐标 */
export interface Point { x: number, y: number }

/** 浮起的东西在视口里的位置和大小 */
export interface Rect { x: number, y: number, width: number, height: number }

/** 能自动滚动的上下边（视口）：顶栏下沿和播放条上沿 */
export interface DragSortEdges { top: number, bottom: number }

/** 拖动中列表的状态：拿起了哪几项、空位在哪、预览顺序是什么 */
export interface DragSortState {
  readonly grabbed: number
  /** 一起挪的几项，按列表里的先后 */
  readonly moving: readonly number[]
  /** 没被拿走的几项，按列表里的先后 */
  readonly rest: readonly number[]
  /** 空位在 rest 里的第几个（0 到 rest.length） */
  readonly target: number
  /** 拿起时的空位：放下时没变就不提交（多选非连续时 preview 一开始就和 ids 不同） */
  readonly startTarget: number
  /** 拖动中列表显示的顺序：moving 放进 rest 的空位 */
  readonly preview: readonly number[]
}

/** 一次拖动怎么结束的 */
export interface DragSortResult {
  /** 顺序变了没有；变了才提交 */
  readonly moved: boolean
  /** 松手前列表显示的顺序（没变就是原来的顺序） */
  readonly order: readonly number[]
  readonly target: number
  /** Esc、右键、切走窗口、指针被收回：不提交 */
  readonly cancelled: boolean
  readonly grabbed: number
}

export interface DragSortSessionOptions<S> {
  /** 列表现在的顺序 */
  ids: () => readonly number[]
  /** 按下的这一项是哪几项一起挪（多选里是勾选的，单个排序是它自己），按列表先后；默认只有它 */
  groupOf?: (id: number) => readonly number[]
  /** 开始拖：量一次几何；拿不到（元素不在了）返回 null */
  begin: (id: number, at: Point) => S | null
  /** 指针落在第几个空位；slots 是没被拿走的个数（返回 0 到 slots） */
  targetAt: (scene: S, at: Point, slots: number) => number
  /** 页面上沿、下沿（视口）：拖到边缘自动滚动 */
  edges: () => DragSortEdges
  /**
   * 松手、键盘移动：提交新的顺序。
   * 键盘（Alt + ↑ / ↓）只有“按整张顺序提交”的适配器才走核心；按“挪到谁前面”提交的适配器
   * 设 keyboard: false，自己用 movedBefore 调 App。
   */
  commit: (order: readonly number[], state: DragSortState | null) => boolean
  /** 还在落位 / 展开：新的按下先不接 */
  busy?: () => boolean
  /** 键盘的 Alt + ↑ / ↓ 能不能走核心（按“挪到谁前面”提交的适配器设 false，自己实现） */
  keyboard?: boolean
  /** 快速定位时不要让边缘滚动接手 */
  scrollable?: () => boolean
  /** 指针动了：每次 pointermove（开始拖以后）调用；快速定位在这里先滚再重算 */
  onPointer?: (at: Point) => void
  onChange?: (state: DragSortState | null) => void
  onStart?: (state: DragSortState) => void
  onEnd?: (result: DragSortResult) => void
}

export interface DragSortSession {
  /** 拖动中；没拖时是 null */
  readonly state: DragSortState | null
  /** 指针最后在哪（视口）；没拖时是 null */
  readonly pointer: Point | null
  /** 一个把手：把它收到的按下、移动、松开、点击交给核心 */
  grip: (id: number) => Grip
  /** 这一帧要自动滚动多少（px，正数往下）；不滚时是 0。滚动仍由浏览器做 */
  frame: (dt: number) => number
  /** 滚动以后按指针位置重算空位 */
  track: () => void
  /** Esc、右键、切走窗口：作废，不提交 */
  cancel: () => void
  /** Alt + ↑ / ↓：不在拖动时把这一项移一位并提交 */
  moveByKeyboard: (id: number, delta: -1 | 1) => boolean
}

/** 鼠标按下后挪过这么多（px）才算拖；触屏按住立即开始 */
const SLOP = 5

interface Press {
  pointerId: number
  /** 鼠标按下还没挪够起拖距离：记着按下的地方 */
  pending: Point | null
}

export function createDragSortSession<S>(options: DragSortSessionOptions<S>): DragSortSession {
  let state: DragSortState | null = null
  let pointer: Point | null = null
  let scene: S | null = null
  let press: Press | null = null
  let holdAtEdge = 0

  function emit() {
    options.onChange?.(state)
  }

  /** 拖动中列表显示的顺序：把一起挪的几项放进空位 */
  function previewOf(rest: readonly number[], moving: readonly number[], target: number): readonly number[] {
    const next = [...rest]
    next.splice(target, 0, ...moving)
    return next
  }

  function setTarget(target: number) {
    if (!state || !scene || !pointer)
      return
    const next = clamp(target, 0, state.rest.length)
    if (next === state.target)
      return
    state = { ...state, target: next, preview: previewOf(state.rest, state.moving, next) }
    emit()
  }

  /** 按指针位置重算空位；指针没动也每帧调用，列表在指针底下滚动时目标会变 */
  function track() {
    if (!state || !scene || !pointer)
      return
    setTarget(options.targetAt(scene, pointer, state.rest.length))
  }

  /** 开始拖：先量几何；拿不到就不接这次按下 */
  function begin(id: number, at: Point): boolean {
    if (state)
      return false
    const next = options.begin(id, at)
    if (!next)
      return false
    const ids = options.ids()
    const index = ids.indexOf(id)
    if (index < 0) {
      scene = null
      return false
    }
    const wanted = new Set(options.groupOf?.(id) ?? [id])
    if (!wanted.has(id))
      wanted.add(id)
    const moving = ids.filter(item => wanted.has(item))
    const rest = ids.filter(item => !wanted.has(item))
    // 一起挪的几项前面有几项被一起拿走：空位就是它们原来的位置
    const before = index - ids.slice(0, index).filter(item => wanted.has(item)).length
    scene = next
    pointer = at
    state = { grabbed: id, moving, rest, target: before, startTarget: before, preview: previewOf(rest, moving, before) }
    holdAtEdge = 0
    options.onStart?.(state)
    emit()
    track()
    return true
  }

  function end(result: DragSortResult) {
    state = null
    pointer = null
    scene = null
    press = null
    holdAtEdge = 0
    options.onEnd?.(result)
    emit()
  }

  function cancel() {
    if (!state || !pointer)
      return
    end({ moved: false, order: state.preview, target: state.target, cancelled: true, grabbed: state.grabbed })
  }

  function release(sample: PointerSample) {
    if (!press || press.pointerId !== sample.pointerId)
      return
    // 鼠标还没挪够 5px：这次只是点按，不算拖
    if (press.pending) {
      press = null
      return
    }
    const ended = state
    if (!ended)
      return
    // 基线语义：按空位有没有变判断，不拿 preview 比（多选非连续时 preview 一开始就不同）
    const moved = ended.target !== ended.startTarget
    press = null
    if (moved) {
      try {
        options.commit(ended.preview, ended)
      }
      finally {
        // commit 抛错（调用方拒绝了这次顺序）也要把拖动态收干净：不然下一次按下会被 state 挡住
        end({ moved, order: ended.preview, target: ended.target, cancelled: false, grabbed: ended.grabbed })
      }
      return
    }
    end({ moved, order: ended.preview, target: ended.target, cancelled: false, grabbed: ended.grabbed })
  }

  function grip(id: number): Grip {
    return {
      get holding() {
        return press !== null
      },
      press(sample) {
        if (state || options.busy?.())
          return false
        if (!sample.isPrimary || sample.button !== 0)
          return false
        // 上一次没等到松开（右键菜单、切走窗口、松开没传到页面上）：先清干净，连 pending 一起
        if (press)
          abandon()
        press = { pointerId: sample.pointerId, pending: sample.pointerType === 'touch' ? null : { x: sample.x, y: sample.y } }
        if (sample.pointerType !== 'touch')
          return true
        const started = begin(id, { x: sample.x, y: sample.y })
        if (!started)
          press = null
        return started
      },
      move(sample) {
        if (!press || press.pointerId !== sample.pointerId)
          return
        if (pressBroken(sample.buttons))
          return abandon()
        const at = { x: sample.x, y: sample.y }
        if (press.pending) {
          if (Math.hypot(at.x - press.pending.x, at.y - press.pending.y) < SLOP)
            return
          press.pending = null
          if (!begin(id, at)) {
            press = null
            return
          }
        }
        pointer = at
        options.onPointer?.(at)
        track()
      },
      release(sample) {
        release(sample)
      },
      abandon(pointerId) {
        abandon(pointerId)
      },
      click() {
        // 排序把手没有点按行为；拖过以后的 click 一律吞掉（基线 attachWindowGrip 的做法）
        return true
      },
    }
  }

  function abandon(pointerId?: number) {
    if (!press)
      return
    if (pointerId !== undefined && pointerId !== press.pointerId)
      return
    const wasDragging = state !== null
    press = null
    if (wasDragging)
      cancel()
  }

  return {
    get state() {
      return state
    },
    get pointer() {
      return pointer
    },
    grip,
    frame(dt) {
      if (!state || !pointer)
        return 0
      if (options.scrollable && !options.scrollable()) {
        holdAtEdge = 0
        return 0
      }
      const { top, bottom } = options.edges()
      const scroll = edgeScroll(dt, pointer.y, top, bottom, holdAtEdge)
      holdAtEdge = scroll.hold
      return scroll.amount
    },
    track,
    cancel,
    moveByKeyboard(id, delta) {
      if (state || options.keyboard === false)
        return false
      const next = moveKey(options.ids(), id, delta)
      return next !== null && options.commit(next, null)
    },
  }
}

/** 相邻的一项能在哪：挪不动（到两头、没有这一项）时是 null */
function neighbor(ids: readonly number[], id: number, delta: -1 | 1): { from: number, to: number } | null {
  const from = ids.indexOf(id)
  const to = from + delta
  return from < 0 || to < 0 || to >= ids.length ? null : { from, to }
}

/** 把相邻的一项挪一位；挪不动（到两头、没有这一项）返回 null。按整张顺序提交的适配器用 */
function moveKey(ids: readonly number[], id: number, delta: -1 | 1): readonly number[] | null {
  const at = neighbor(ids, id, delta)
  if (!at)
    return null
  const next = [...ids]
  next.splice(at.from, 1)
  next.splice(at.to, 0, id)
  return next
}

/**
 * Alt + ↑ / ↓ 的落点：把这一项挪到哪一项前面，给 App.moveSongs 这种“挪到谁前面”的适配器用。
 * - 返回编号：挪到这一首前面（上移时是前一首）
 * - 返回 null：挪到最后（下移时后面没有歌了）
 * - 返回 undefined：挪不动（没有这一项、或者已经在两头）
 */
export function movedBefore(ids: readonly number[], id: number, delta: -1 | 1): number | null | undefined {
  const at = neighbor(ids, id, delta)
  if (!at)
    return undefined
  return delta < 0 ? ids[at.to]! : ids[at.to + 1] ?? null
}

/** 行列表（手机歌单、虚拟歌曲列表）：按浮起那一行的中线算空位 */
export interface RowTrack {
  /** 指针比被拿起那一行的上沿多深（px） */
  grabY: number
  /** 列表上沿（视口） */
  listTop: number
  /** 行距（px） */
  pitch: number
  /** 一行多高（px） */
  height: number
  /** 浮起的东西能到的最上 / 最下（视口） */
  minTop: number
  maxTop: number
}

export function rowTrack(g: RowTrack, pointerY: number, slots: number): { y: number, target: number } {
  const y = clamp(pointerY - g.grabY, g.minTop, g.maxTop)
  const target = clamp(Math.floor((y + g.height / 2 - g.listTop) / g.pitch), 0, slots)
  return { y, target }
}

/** 卡片网格（桌面歌单）：按格位算行列，再按行优先数到第几个空位 */
export interface GridTrack {
  /** 网格左上角（文档坐标；拖动时页面会滚，所以要带上当时的滚动量） */
  gridLeft: number
  gridTop: number
  /** 当前页面滚到哪（px）：指针是视口坐标，加回去才是文档坐标 */
  scrollX: number
  scrollY: number
  pitchX: number
  pitchY: number
  columns: number
  grabX: number
  grabY: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * 卡片网格：ghost 在视口里夹紧；目标空位用**未夹紧的指针 + 滚动量**算（和基线一致，
 * 指针被夹在网格边上、或者页面滚到下一行时，目标仍能继续前进）。
 */
export function gridTrack(g: GridTrack, pointerX: number, pointerY: number, slots: number): { x: number, y: number, target: number } {
  const x = clamp(pointerX - g.grabX, g.minX, g.maxX)
  const y = clamp(pointerY - g.grabY, g.minY, g.maxY)
  const docX = pointerX + g.scrollX
  const docY = pointerY + g.scrollY
  const column = clamp(Math.floor((docX - g.gridLeft) / g.pitchX), 0, g.columns - 1)
  const row = Math.max(0, Math.floor((docY - g.gridTop) / g.pitchY))
  return { x, y, target: clamp(row * g.columns + column, 0, slots) }
}
