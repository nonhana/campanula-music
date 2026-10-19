import type { Attachment } from 'svelte/attachments'
import type { Song } from '#lib/api/library.js'
import type { PlaylistSelection } from './playlist-selection.svelte'
import { SvelteMap, SvelteSet } from 'svelte/reactivity'
import { DURATIONS } from '../motion-tokens'
import { attachGrip, createPageHold } from '../press'
import { formatCount } from './view'

// 多选里的拖动排序（#36，Spec #11“多选、拖拽与换封面”，原型 docs/prototype/dnd.md）：
// 只在多选模式里按每行的把手拖；平时行上没有把手，单击照常播放。
// - 勾选的几首一起拖，保持原来的先后；一起拖的几首前面被一起拿走的行收起来，页面往回滚同样的高度，手指底下不跳
// - 快速滑动是滚动（把手之外的行照常滚）；按住把手立即拖
// - 拖到上下边缘自动滚动：越深越快（平方），停在边缘越久越快（3 秒内最多加速到 8 倍），边缘区 72px；
//   手机上边缘区从迷你播放条（多选时是底部操作条）的上沿算起
// - 快速定位：拖到右侧 44px 窄条按比例跳；从窄条里开始拖（手机上的把手正好在窄条里）要先往左离开窄条，
//   快速定位才接手，提示也等离开以后再出现
// - 浮起的行跟着指针；“移到第 N 首”的标签在浮起的行上面，最上层
// - 桌面拖动中按 Esc 取消；焦点在某一行时 Alt + ↑ / ↓ 移一位（由列表接住按键，走同一个 move）
// 被拖的那一行在虚拟列表里一直保留（VirtualList 的 keep），Android 上手指底下的元素被卸载后触摸事件会断

/** 一行的高度（px，DESIGN.md Song Row）：虚拟列表和拖动计算共用 */
export const SONG_ROW_HEIGHT = 56
const ROW = SONG_ROW_HEIGHT
/** 快速定位窄条的宽度（px） */
const RAIL = 44
/** “移到第 N 首”的标签在浮起的行上面多高（px） */
const LABEL_GAP = 14
/** 拖到边缘多深开始自动滚动（px） */
const EDGE = 72
/** 自动滚动最快多少 px/秒 */
const MAX_SPEED = 1600
/** 停在边缘 3 秒内最多加速到几倍 */
const ACCEL = 8
const ACCEL_TIME = 3000
/** 松手后浮起的行落进空位的时长（ms，和 duration-move-state 一样），落稳了才换真正的顺序 */
const SETTLE_MS = DURATIONS.state

interface SongDragOptions {
  /** 列表里显示着的歌（搜索时不分心：能排序时没有搜索） */
  songs: () => readonly Song[]
  selection: PlaylistSelection
  /** 把这几首挪到 before 那一首前面（null 是最后）；App 会按列表里的先后排 */
  move: (songIds: readonly number[], before: number | null) => boolean
  /** 歌曲列表的容器：浮起的行和它一样宽、左边对齐 */
  host: () => HTMLElement | undefined
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

export class SongDrag {
  /** 拖着（包括松手后落位的 160ms） */
  dragging = $state(false)
  /** 已经松手，浮起的行在落进空位 */
  settling = $state(false)
  /** 列表里没被拿走的歌，按原来的先后 */
  rest = $state.raw<readonly Song[]>([])
  /** 一起拖的几首，按列表里的先后 */
  moved = $state.raw<readonly Song[]>([])
  /** 手指按住的那一首：浮起的行显示它 */
  grabbed = $state.raw<Song | null>(null)
  /** 空位在第几行（0 起算） */
  target = $state(0)
  ghostY = $state(0)
  ghostLeft = $state(0)
  ghostWidth = $state(0)
  /** 正在快速定位 */
  scrubbing = $state(false)
  /** 快速定位条能不能接手：从窄条外开始拖马上能；从窄条里开始拖要先离开再回来 */
  railArmed = $state(false)
  /** 窄条的位置：顶部、离视口底边多少（CSS 的 top / bottom） */
  railTop = $state(0)
  railBottom = $state(0)
  private viewportH = $state(844)
  /** 一起拖几首时，开始拖动为了让开上面的行往上滚了多少（取消时滚回去） */
  private scrollAdjust = 0
  private pointer: number | null = null
  private originY = new SvelteMap<number, number>()
  private startTarget = 0
  private grabY = 0
  private pointerX = 0
  private pointerY = 0
  private startedInRail = false
  private raf = 0
  private lastFrame = 0
  private holdAtEdge = 0
  private settleTimer: ReturnType<typeof setTimeout> | undefined
  private readonly pageHold = createPageHold()
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 每个把手一份、不会逐帧变的接线缓存，不参与渲染
  private readonly handles = new Map<number, Attachment<HTMLElement>>()

  readonly movedIds = $derived(new SvelteSet(this.moved.map(song => song.id)))
  readonly hintTop = $derived(this.ghostY + ROW / 2 < this.viewportH / 2 ? '75%' : '25%')
  /** 窄条最下面那个位置：一起拖几首时是这一组最前那首能到的最后一个位置（原型同） */
  readonly railTotal = $derived(this.rest.length + 1)

  constructor(private readonly options: SongDragOptions) {}

  /** 浮起的行落在第几首（1 起算） */
  get position(): number {
    return this.target + 1
  }

  get label(): string {
    return `${this.scrubbing ? '定位到' : '移到'}第 ${formatCount(this.position)} 首`
  }

  /** 被拖的这几行在列表里的原来位置（拖动时藏起来，但仍挂载）：只有被拖的歌才查，查不到就是坏了不变量 */
  originOf(songId: number): number {
    return this.originY.get(songId)!
  }

  /** 列表里这一行放哪（拖动时让开空位；被拖的几首留在原位、藏起来） */
  placeOf = (song: Song, index: number): number => {
    if (!this.dragging)
      return index * ROW
    if (index < this.rest.length)
      return (index < this.target ? index : index + 1) * ROW
    return this.originOf(song.id)
  }

  /** 被拖的行：一直挂载（keep），同时藏起来（hidden）——同一个谓词，原来的位置留空 */
  keep = (song: Song): boolean => this.dragging && this.movedIds.has(song.id)

  /** 拖动时浮起的行显示哪一首：手指按住的那首 */
  get ghostSong(): Song | null {
    return this.grabbed ?? this.moved[0] ?? null
  }

  /**
   * 把手：按住立即拖（触屏、鼠标都一样）。
   * 每一行有自己的接线和“这一次按下”：虚拟列表滚动时别的行被回收，不能把它们把手上的清理当成“被拖的行被拿掉了”
   * （那样滚一下就会取消正在进行的拖动）。只有按着的那个把手被拿掉时才作废
   */
  handle(song: Song): Attachment<HTMLElement> {
    let attachment = this.handles.get(song.id)
    if (!attachment) {
      attachment = (element) => {
        let pressed = false
        /** 这一次按住的是哪根手指（第二根手指的点按、松开不能插手） */
        let activePointer: number | null = null
        /** 鼠标按下还没挪动：等挪过 5px 才开始拖（只看画面上浮起、还没动，不该像已经开始拖） */
        let pending: { x: number, y: number } | null = null
        return attachGrip({
          get holding() {
            return pressed
          },
          press: (sample) => {
            if (pressed || this.dragging || sample.button !== 0)
              return false
            activePointer = sample.pointerId
            if (sample.pointerType === 'mouse') {
              pressed = true
              pending = { x: sample.x, y: sample.y }
              return true
            }
            // 触屏按住把手立即拖
            const started = this.start(song, element, sample)
            pressed = started
            if (!started)
              activePointer = null
            return started
          },
          move: (sample) => {
            if (!pressed || sample.pointerId !== activePointer)
              return
            if (pending) {
              if (Math.hypot(sample.x - pending.x, sample.y - pending.y) < 5)
                return
              pending = null
              if (!this.start(song, element, sample)) {
                pressed = false
                activePointer = null
                return
              }
            }
            this.move(sample)
          },
          release: (sample) => {
            if (!pressed || sample.pointerId !== activePointer)
              return
            pressed = false
            activePointer = null
            if (pending) {
              pending = null
              return
            }
            this.release()
          },
          abandon: (pointerId) => {
            if (!pressed || (pointerId !== undefined && pointerId !== activePointer))
              return
            pressed = false
            activePointer = null
            if (pending) {
              pending = null
              return
            }
            this.abandon(pointerId)
          },
          click: () => {},
        })(element)
      }
      this.handles.set(song.id, attachment)
    }
    return attachment
  }

  private start(song: Song, row: HTMLElement, sample: { pointerId: number, x: number, y: number }): boolean {
    // 另一根手指已经开始了拖动（第二根手指按下的把手也在等挪动）：这次不算
    if (this.dragging || this.pointer !== null)
      return false
    const list = this.options.songs()
    const index = list.findIndex(item => item.id === song.id)
    if (index < 0)
      return false
    const multi = this.options.selection.has(song.id) && this.options.selection.size > 1
    const moving = multi ? list.filter(item => this.options.selection.has(item.id)) : [song]
    const movingIds = moving.map(item => item.id)
    const before = multi ? list.slice(0, index).filter(item => movingIds.includes(item.id)).length : 0
    const rect = row.getBoundingClientRect()
    const host = this.options.host()
    if (!host)
      return false
    const hostRect = host.getBoundingClientRect()

    this.originY = new SvelteMap(list.flatMap((item, at) => (movingIds.includes(item.id) ? [[item.id, at * ROW] as const] : [])))
    this.rest = list.filter(item => !movingIds.includes(item.id))
    this.moved = list.filter(item => movingIds.includes(item.id))
    this.grabbed = list[index]!
    // 一起拖的几首前面也有被拿走的行：页面往回滚同样的高度，手指底下的空隙不跳
    const scrollTop = window.scrollY
    if (before)
      window.scrollBy(0, -before * ROW)
    this.scrollAdjust = window.scrollY - scrollTop
    this.target = index - before
    this.startTarget = this.target
    this.grabY = sample.y - rect.top
    this.pointerX = sample.x
    this.pointerY = sample.y
    // 浮起的行先在手指底下（一起拖的几首前面拿走了行、页面往上滚了，也不让手指底下的东西跳）
    this.ghostY = rect.top
    this.ghostLeft = hostRect.left
    this.ghostWidth = hostRect.width
    this.viewportH = window.innerHeight
    this.startedInRail = sample.x >= window.innerWidth - RAIL
    this.railArmed = !this.startedInRail
    this.scrubbing = false
    this.holdAtEdge = 0
    this.pointer = sample.pointerId
    this.dragging = true
    this.settling = false
    this.railTop = this.topEdge() + 8
    this.railBottom = window.innerHeight - this.bottomEdge() + 8
    this.pageHold(true)
    window.addEventListener('keydown', this.onKey, true)
    this.lastFrame = performance.now()
    this.raf = requestAnimationFrame(this.frame)
    return true
  }

  private move(sample: { pointerId: number, x: number, y: number }): void {
    if (sample.pointerId !== this.pointer)
      return
    this.pointerX = sample.x
    this.pointerY = sample.y
    if (this.settling)
      return
    const railLeft = window.innerWidth - RAIL
    if (!this.railArmed) {
      // 从窄条里开始的拖动：先往左离开窄条，快速定位才接手（手机上把手正好在窄条里）
      if (this.pointerX < railLeft - 24)
        this.railArmed = true
      return
    }
    if (!this.scrubbing && this.pointerX > railLeft) {
      this.scrubbing = true
      this.scrubTo(this.pointerY)
    }
    else if (this.scrubbing && this.pointerX < railLeft - 24) {
      this.scrubbing = false
    }
    if (this.scrubbing)
      this.scrubTo(this.pointerY)
  }

  private release(): void {
    if (this.pointer === null)
      return
    this.pointer = null
    this.stop()
    this.pageHold(false)
    if (!this.dragging || this.settling)
      return
    const moved = this.target !== this.startTarget
    if (!moved) {
      this.undoScroll()
      this.reset()
      return
    }
    // 浮起的行落进空位（160ms），落稳了再换成真正的顺序
    this.settling = true
    this.ghostY = this.listTop() + this.target * ROW
    const before = this.rest[this.target]?.id ?? null
    const songIds = this.moved.map(song => song.id)
    this.settleTimer = setTimeout(() => {
      this.settleTimer = undefined
      this.options.move(songIds, before)
      this.reset()
    }, SETTLE_MS)
  }

  private abandon(pointerId?: number): void {
    if (pointerId !== undefined && pointerId !== this.pointer)
      return
    this.cancel()
  }

  /** 拖动作废（Esc、页面藏起来、右键、指针被收回、多选退出）：回到原处，什么都不提交 */
  cancel(): void {
    if (this.settleTimer !== undefined) {
      clearTimeout(this.settleTimer)
      this.settleTimer = undefined
    }
    this.pointer = null
    this.stop()
    this.pageHold(false)
    if (!this.dragging && !this.settling)
      return
    this.undoScroll()
    this.reset()
  }

  /** 取消时把开始拖动为了让开上面的行滚的那一段滚回去（落好了就不动） */
  private undoScroll(): void {
    if (this.scrollAdjust === 0)
      return
    window.scrollBy(0, -this.scrollAdjust)
    this.scrollAdjust = 0
  }

  /** 键盘：焦点所在这一行 Alt + ↑ / ↓ 移一位（桌面） */
  moveByKeyboard(songId: number, delta: -1 | 1): boolean {
    if (this.dragging)
      return false
    const list = this.options.songs()
    const index = list.findIndex(song => song.id === songId)
    const to = index + delta
    if (index < 0 || to < 0 || to >= list.length)
      return false
    const before = delta < 0 ? list[to]!.id : list[to + 1]?.id ?? null
    return this.options.move([songId], before)
  }

  private stop(): void {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.onKey, true)
    this.holdAtEdge = 0
  }

  private reset(): void {
    this.dragging = false
    this.settling = false
    this.scrubbing = false
    this.rest = []
    this.moved = []
    this.grabbed = null
    this.originY = new SvelteMap()
    this.holdAtEdge = 0
    this.scrollAdjust = 0
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape')
      return
    event.preventDefault()
    event.stopPropagation()
    this.cancel()
  }

  /** 页面上沿：吸在顶上的顶栏下沿（两个骨架都标了 data-page-top） */
  private topEdge(): number {
    const top = document.querySelector<HTMLElement>('[data-page-top]')
    return top?.getBoundingClientRect().bottom ?? 0
  }

  /** 页面下沿：迷你播放条 / 底部操作条 / 桌面播放条的上沿；没有就是窗口底 */
  private bottomEdge(): number {
    const bar = document.querySelector<HTMLElement>('[data-player-bar]')
    return bar?.getBoundingClientRect().top ?? window.innerHeight
  }

  private listTop(): number {
    return this.options.host()?.getBoundingClientRect().top ?? 0
  }

  private readonly frame = (now: number): void => {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    const top = this.topEdge()
    const bottom = this.bottomEdge()

    if (this.scrubbing) {
      this.holdAtEdge = 0
    }
    else {
      let direction = 0
      let depth = 0
      if (this.pointerY < top + EDGE) {
        direction = -1
        depth = clamp((top + EDGE - this.pointerY) / EDGE, 0, 1)
      }
      else if (this.pointerY > bottom - EDGE) {
        direction = 1
        depth = clamp((this.pointerY - (bottom - EDGE)) / EDGE, 0, 1)
      }
      if (direction !== 0) {
        this.holdAtEdge += dt
        // 越深越快（平方），停在边缘越久越快（按深度加权，轻轻碰到边缘时不会突然飞起来）
        const ramp = 1 + (ACCEL - 1) * clamp(this.holdAtEdge / (ACCEL_TIME / 1000), 0, 1) * depth
        window.scrollBy(0, direction * MAX_SPEED * depth * depth * ramp * dt)
      }
      else {
        this.holdAtEdge = 0
      }
      // 浮起的行别顶到吸在顶上的顶栏：给上面的“移到第 N 首”留出位置
      this.ghostY = clamp(this.pointerY - this.grabY, top + LABEL_GAP, bottom - ROW)
      const center = this.ghostY + ROW / 2 - this.listTop()
      this.target = clamp(Math.floor(center / ROW), 0, this.rest.length)
    }
    this.raf = requestAnimationFrame(this.frame)
  }

  private scrubTo(y: number): void {
    // 和窄条对齐：窄条上下各留 8px，轨道再缩进 24px 放首尾的数字
    const trackTop = this.railTop + 24
    const trackBottom = (window.innerHeight - this.railBottom) - 24
    const ratio = clamp((y - trackTop) / Math.max(1, trackBottom - trackTop), 0, 1)
    this.target = Math.round(ratio * this.rest.length)
    // 把落点滚到可见区域的正中，浮起的行就停在那道空隙上
    const middle = (this.topEdge() + this.bottomEdge()) / 2
    const hostTop = this.listTop() + window.scrollY
    window.scrollTo({ top: hostTop + this.target * ROW + ROW / 2 - middle })
    this.ghostY = this.listTop() + this.target * ROW
  }
}
