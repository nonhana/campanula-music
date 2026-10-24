import type { Attachment } from 'svelte/attachments'
import type { Song } from '#lib/api/library.js'
import type { DragSortEdges, DragSortResult, DragSortState, Point, Rect } from '../shared/drag-sort'
import type { PlaylistSelection } from './playlist-selection.svelte'
import { SvelteMap, SvelteSet } from 'svelte/reactivity'
import { clamp } from '../shared/clamp'
import { movedBefore, rowTrack } from '../shared/drag-sort'
import { DragSort, pageEdges } from '../shared/drag-sort.svelte'
import { DURATIONS, STAGGER } from '../shared/motion-tokens'
import { formatCount } from '../shared/text'
import { SONG_ROW_HEIGHT } from '../songs/view'

// 多选里的拖动排序（#36，Spec #11“多选、拖拽与换封面”，原型 docs/prototype/dnd.md）：
// 只在多选模式里按每行的把手拖；平时行上没有把手，单击照常播放。
// - 勾选的几首一起拖，保持原来的先后；一起拖的几首前面被一起拿走的行收起来，页面往回滚同样的高度，手指底下不跳
// - 快速滑动是滚动（把手之外的行照常滚）；按住把手立即拖
// - 拖到上下边缘自动滚动（参数在 scroll-edge.ts）
// - 快速定位：拖到右侧 44px 窄条按比例跳；从窄条里开始拖（手机上的把手正好在窄条里）要先往左离开窄条，
//   快速定位才接手。窄条上只有刻度和滑块，不写字
// - 浮起的行跟着指针；“第 N 首”的标签在浮起的行上面，最上层
// - 桌面拖动中按 Esc 取消；焦点在某一行时 Alt + ↑ / ↓ 移一位（由列表接住按键，走同一个 move）
// 手势规则、按下协议、边缘滚动、Esc、页边测量在 drag-sort.ts / drag-sort.svelte.ts 里只写一份；
// 这里只做歌曲专有的多首一起挪、快速定位和拿起 / 落位 / 展开三个动画阶段。
// 被拖的那一行在虚拟列表里一直保留（VirtualList 的 keep），Android 上手指底下的元素被卸载后触摸事件会断

const ROW = SONG_ROW_HEIGHT
/** 快速定位窄条的宽度（px） */
const RAIL = 44
/** “第 N 首”的标签在浮起的行上面多高（px） */
const LABEL_GAP = 14
/** 拿起后，被拖的行往浮起的行收拢、淡出的时长（ms，和 duration-state 一样） */
const LIFT_MS = DURATIONS.state
/** 松手提交后浮起的行落进空位的视觉时长（ms，和 duration-move-state 一样） */
const SETTLE_MS = DURATIONS.state
/** 落位后，被拖的行从浮起的行展开到新位置的时长（ms，和 duration-state 一样） */
const EXPAND_MS = DURATIONS.state
/** 展开时每一行晚一点开始（ms，和依次飘入的步长一样） */
const EXPAND_STAGGER = STAGGER.step

interface SongDragOptions {
  /** 列表里显示着的歌（搜索时不分心：能排序时没有搜索） */
  songs: () => readonly Song[]
  selection: PlaylistSelection
  /** 把这几首挪到 before 那一首前面（null 是最后）；App 会按列表里的先后排 */
  move: (songIds: readonly number[], before: number | null) => boolean
  /** 歌曲列表的容器：浮起的行和它一样宽、左边对齐 */
  host: () => HTMLElement | undefined
}

interface SongScene {
  grabY: number
  left: number
  width: number
  height: number
}

export class SongDrag {
  private readonly sort: DragSort<SongScene>
  /** 正在拖着 */
  dragging = $state(false)
  /** 刚拿起：被拖的行往浮起的行收拢、淡出 */
  lifting = $state(false)
  /** 已经松手，浮起的行在落进空位 */
  settling = $state(false)
  /** 浮起的行已经落进空位：被拖的行正从它展开到新位置 */
  expanding = $state(false)
  /** 正在快速定位 */
  scrubbing = $state(false)
  /** 窄条的位置：顶部、离视口底边多少（CSS 的 top / bottom） */
  railTop = $state(0)
  railBottom = $state(0)
  /** 浮起的行落位时停在哪（视口纵坐标） */
  settleY = $state(0)
  /** 一起拖的几首：按列表先后的编号、查起来快的集合 */
  private movingIds = $state.raw<ReadonlySet<number>>(new SvelteSet<number>())
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 一次拖动用的查找表，不参与渲染
  private readonly byId = new Map<number, Song>()
  /** 一起拖的几首、按住的那一首：落位、展开时列表已经回到新顺序，影子还要画它们 */
  private movingSongs: readonly Song[] = []
  private grabbedSong: Song | null = null
  /** 没被拖的歌在 rest 里的下标：拖动时用它算视觉位置，不改 items 的顺序 */
  private restIndex = new SvelteMap<number, number>()
  /** 快速定位条能不能接手：从窄条外开始拖马上能；从窄条里开始拖要先离开再回来 */
  private railArmed = false
  /** 快速定位跳到的空位（0..rest.length） */
  private scrubTarget = 0
  /** 一期拖动用到的指针横坐标（窄条判断） */
  private pointerX = 0
  /** 一起拖几首时，开始拖动为了让开上面的行往上滚了多少（取消时滚回去） */
  private scrollAdjust = 0
  /** 松手提交有没有成功：没成就不播落位、展开 */
  private commitOk = true
  private liftTimer: ReturnType<typeof setTimeout> | undefined
  private settleTimer: ReturnType<typeof setTimeout> | undefined
  private expandTimer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly options: SongDragOptions) {
    this.sort = new DragSort<SongScene>({
      ids: () => this.options.songs().map(song => song.id),
      groupOf: id => this.groupOf(id),
      adapter: {
        measure: (id, handle, at) => this.measure(id, handle, at),
        track: (scene, at, edges, slots) => this.track(scene, at, edges, slots),
        slot: (scene, target) => this.slot(scene, target),
      },
      commit: (_order, state) => {
        // 拖动：这一组保持原来的先后，挪到空位前面。键盘走 moveByKeyboard，不经过这里
        if (!state)
          return false
        this.commitOk = this.options.move(state.moving, state.rest[state.target] ?? null)
        return this.commitOk
      },
      busy: () => this.settling || this.expanding,
      // 键盘的 Alt + ↑ / ↓ 走 App.moveSongs（挪到谁前面），不用核心的“整张顺序提交”
      keyboard: false,
      scrollable: () => !this.scrubbing,
      onPointer: at => this.pointer(at),
      onStart: state => this.started(state),
      onEnd: result => this.ended(result),
    })
  }

  /** 拖动中列表按什么顺序画、拖动时列表显示的顺序（预览） */
  get moved(): readonly Song[] {
    return this.movingSongs
  }

  get rest(): readonly Song[] {
    return this.sort.rest.map(id => this.byId.get(id)).filter(song => song !== undefined)
  }

  get grabbed(): Song | null {
    return this.grabbedSong
  }

  get target(): number {
    return this.sort.target
  }

  /** 浮起的行跟到哪（拖动时） */
  get ghostY(): number {
    return this.sort.ghost.y
  }

  get ghostLeft(): number {
    return this.sort.ghost.x
  }

  get ghostWidth(): number {
    return this.sort.ghost.width
  }

  /** 列表里这一行放哪（拖动时让开空位；被拖的几首留在原位、藏起来）。 */
  placeOf = (song: Song, index: number): number => {
    if (!this.dragging || this.movingIds.has(song.id))
      return index * ROW
    const rest = this.restIndex.get(song.id)!
    return (rest < this.sort.target
? rest
: rest + 1) * ROW
  }

  /** 被拖的行：拿起、拖动、落位、展开期间都挂载（keep） */
  keep = (song: Song): boolean => this.sorting && this.movingIds.has(song.id)

  /** 被拖的行什么时候藏起来：收拢结束以后、落位途中；正在收拢和展开时看得见 */
  hideMoved = (song: Song): boolean => this.keep(song) && !this.lifting && !this.expanding

  /** 被拖的行用哪种过渡：拿起时收拢（pick），落位后展开（land）；拖动中藏起来的行保持 pick 的收拢样子 */
  motionOf(song: Song): 'pick' | 'land' | null {
    if (!this.movingIds.has(song.id))
      return null
    return this.expanding ? 'land' : 'pick'
  }

  /** 拿起时这一行往浮起的行收拢多少（px，相对它自己的位置） */
  liftShift(index: number): number {
    if (!this.lifting)
      return 0
    return this.sort.ghost.y - (this.listTop() + index * ROW)
  }

  /** 展开时这一行从浮起的行出发，往上偏多少（px） */
  landShift(song: Song): number {
    if (!this.expanding)
      return 0
    const k = this.moved.findIndex(item => item.id === song.id)
    return k < 0
? 0
: -k * ROW
  }

  /** 展开时第 k 首晚多少开始（ms），做成一叠行依次扇开 */
  landDelay(song: Song): number {
    if (!this.expanding)
      return 0
    const k = this.moved.findIndex(item => item.id === song.id)
    return k < 0
? 0
: k * EXPAND_STAGGER
  }

  /** 拖动、落位、展开：调用方只需要知道“正在排序” */
  get sorting(): boolean {
    return this.dragging || this.settling || this.expanding
  }

  /** 浮起的行显示哪一首：手指按住的那首 */
  get ghostSong(): Song | null {
    return this.grabbed ?? this.moved[0] ?? null
  }

  /** 浮起的行落在第几首（1 起算） */
  get position(): number {
    return this.sort.target + 1
  }

  /** 浮起的行上面的标签：落在第几首（拖动和快速定位都这样写） */
  get label(): string {
    return `第 ${formatCount(this.position)} 首`
  }

  /** 窄条最下面那个位置：一起拖几首时是这一组最前那首能到的最后一个位置（原型同） */
  get railTotal(): number {
    return this.rest.length + 1
  }

  /** 把手：按住立即拖（触屏、鼠标都一样） */
  handle(song: Song): Attachment<HTMLElement> {
    return this.sort.handle(song.id)
  }

  /** 拖动作废（Esc、页面藏起来、右键、指针被收回、多选退出）：回到原处，什么都不提交 */
  cancel(): void {
    this.stopTimers()
    this.sort.cancel()
    this.reset()
  }

  /** 键盘：焦点所在这一行 Alt + ↑ / ↓ 移一位（桌面） */
  moveByKeyboard(songId: number, delta: -1 | 1): boolean {
    if (this.sorting)
      return false
    const list = this.options.songs()
    const before = movedBefore(list.map(song => song.id), songId, delta)
    if (before === undefined)
      return false
    return this.options.move([songId], before)
  }

  /** 一起拖的几首：多选里勾选了这一首时是勾选的几首，否则只有这一首 */
  private groupOf(id: number): readonly number[] {
    const list = this.options.songs()
    const song = list.find(item => item.id === id)
    if (!song || !this.options.selection.mode || !this.options.selection.has(id) || this.options.selection.size <= 1)
      return [id]
    return list.filter(item => this.options.selection.has(item.id)).map(item => item.id)
  }

  private measure(id: number, handle: HTMLElement, at: Point): SongScene | null {
    const list = this.options.songs()
    const index = list.findIndex(song => song.id === id)
    if (index < 0)
      return null
    // 还没挪够 5px 时多选退出了、行被虚拟列表卸掉了：这次按住不算
    if (!this.options.selection.mode || !handle.isConnected)
      return null
    const row = handle.closest<HTMLElement>('[data-song-id]') ?? handle
    const rect = row.getBoundingClientRect()
    const host = this.options.host()
    if (!host)
      return null
    const hostRect = host.getBoundingClientRect()
    this.byId.clear()
    for (const song of list)
      this.byId.set(song.id, song)
    // 一起拖的几首前面也有被拿走的行：页面往回滚同样的高度，手指底下的空隙不跳
    const wanted = new SvelteSet(this.groupOf(id))
    const before = list.slice(0, index).filter(song => wanted.has(song.id)).length
    const scrollTop = window.scrollY
    if (before)
      window.scrollBy(0, -before * ROW)
    this.scrollAdjust = window.scrollY - scrollTop
    this.startedInRail(at.x)
    const edges = pageEdges()
    this.railTop = edges.top + 8
    this.railBottom = window.innerHeight - edges.bottom + 8
    return {
grabY: at.y - rect.top,
left: hostRect.left,
width: hostRect.width,
height: ROW,
}
  }

  private track(scene: SongScene, at: Point, edges: DragSortEdges, slots: number): { ghost: Rect, target: number } {
    if (this.scrubbing) {
      const target = clamp(this.scrubTarget, 0, slots)
      return {
ghost: {
x: scene.left,
y: this.listTop() + target * ROW,
width: scene.width,
height: ROW,
},
target,
}
    }
    const row = rowTrack({
      grabY: scene.grabY,
      listTop: this.listTop(),
      pitch: ROW,
      height: ROW,
      // 浮起的行别顶到吸在顶上的顶栏：给上面的“第 N 首”留出位置
      minTop: edges.top + LABEL_GAP,
      maxTop: edges.bottom - ROW,
    }, at.y, slots)
    return {
ghost: {
x: scene.left,
y: row.y,
width: scene.width,
height: ROW,
},
target: row.target,
}
  }

  private slot(scene: SongScene, target: number): Rect {
    return {
x: scene.left,
y: this.listTop() + target * ROW,
width: scene.width,
height: scene.height,
}
  }

  private started(state: DragSortState): void {
    this.dragging = true
    this.lifting = true
    this.settling = false
    this.expanding = false
    this.commitOk = true
    this.movingIds = new SvelteSet(state.moving)
    this.movingSongs = state.moving.map(id => this.byId.get(id)).filter(song => song !== undefined)
    this.grabbedSong = this.byId.get(state.grabbed) ?? null
    this.restIndex = new SvelteMap(state.rest.map((id, index) => [id, index] as const))
    this.liftTimer = setTimeout(() => {
      this.liftTimer = undefined
      this.lifting = false
    }, LIFT_MS)
  }

  private ended(result: DragSortResult): void {
    this.dragging = false
    this.stopTimers()
    this.lifting = false
    if (result.cancelled || !result.moved || !this.commitOk) {
      this.undoScroll()
      this.reset()
      return
    }
    this.scrollAdjust = 0
    this.settling = true
    this.expanding = false
    this.settleY = this.sort.settleAt(result.target)?.y ?? this.listTop() + result.target * ROW
    this.settleTimer = setTimeout(() => {
      this.settleTimer = undefined
      this.settling = false
      this.expanding = true
      this.expandTimer = setTimeout(() => {
        this.expandTimer = undefined
        this.expanding = false
        this.reset()
      }, EXPAND_MS + Math.max(0, this.moved.length - 1) * EXPAND_STAGGER)
    }, SETTLE_MS)
  }

  private pointer(at: Point): void {
    this.pointerX = at.x
    if (this.settling || this.expanding)
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
      this.scrubTo(at.y)
    }
    else if (this.scrubbing && this.pointerX < railLeft - 24) {
      this.scrubbing = false
    }
    if (this.scrubbing)
      this.scrubTo(at.y)
  }

  private scrubTo(y: number): void {
    // 和窄条对齐：窄条上下各留 8px，轨道再缩进 24px 放首尾的数字
    const trackTop = this.railTop + 24
    const trackBottom = (window.innerHeight - this.railBottom) - 24
    const ratio = clamp((y - trackTop) / Math.max(1, trackBottom - trackTop), 0, 1)
    this.scrubTarget = Math.round(ratio * this.rest.length)
    const edges = pageEdges()
    const middle = (edges.top + edges.bottom) / 2
    const hostTop = this.listTop() + window.scrollY
    window.scrollTo({ top: hostTop + this.scrubTarget * ROW + ROW / 2 - middle })
  }

  private startedInRail(x: number): void {
    const inRail = x >= window.innerWidth - RAIL
    this.railArmed = !inRail
    this.scrubbing = false
  }

  private stopTimers(): void {
    if (this.liftTimer !== undefined) {
      clearTimeout(this.liftTimer)
      this.liftTimer = undefined
    }
    if (this.settleTimer !== undefined) {
      clearTimeout(this.settleTimer)
      this.settleTimer = undefined
    }
    if (this.expandTimer !== undefined) {
      clearTimeout(this.expandTimer)
      this.expandTimer = undefined
    }
  }

  /** 取消时把开始拖动为了让开上面的行滚的那一段滚回去（落好了就不动） */
  private undoScroll(): void {
    if (this.scrollAdjust === 0)
      return
    window.scrollBy(0, -this.scrollAdjust)
    this.scrollAdjust = 0
  }

  private reset(): void {
    this.stopTimers()
    this.dragging = false
    this.lifting = false
    this.settling = false
    this.expanding = false
    this.scrubbing = false
    this.movingIds = new SvelteSet<number>()
    this.movingSongs = []
    this.grabbedSong = null
    this.restIndex = new SvelteMap()
    this.scrollAdjust = 0
    this.byId.clear()
  }

  private listTop(): number {
    return this.options.host()?.getBoundingClientRect().top ?? 0
  }
}
