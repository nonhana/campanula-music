import type { Attachment } from 'svelte/attachments'

import type { Playlist } from '#lib/api/library.js'

import type { DragSortEdges, DragSortResult, Point, Rect } from '../shared/drag-sort'
import { gridTrack, rowTrack } from '../shared/drag-sort'
import type { DragSortAdapter, DragSortTrack } from '../shared/drag-sort.svelte'
import { DragSort } from '../shared/drag-sort.svelte'
import { moveMs } from '../shared/motion'
import { DURATIONS } from '../shared/motion-tokens'
import { SONG_ROW_HEIGHT } from '../songs/view'

// 曲库自建歌单之间的排序（#37，原型 docs/prototype/dnd.md 方案 C）：手机横版列表、桌面封面网格，同一个排序器按当前布局量几何。
// 点“排序”进入、按住把手立即拖、松手提交、点“完成”退出；只有自建歌单参与，我喜欢的音乐固定最前，收藏的不参与。
// 边缘滚动、Esc、键盘 Alt+↑/↓ 都在 drag-sort.* 只写一份；这里只量两种布局、画影子。

const ROW = SONG_ROW_HEIGHT
const GAP = 8
/** 浮起的卡片四周多出来的白色衬边（px） */
const GHOST_PAD = 8
const GAP_X = 20
const GAP_Y = 24

interface RowsScene {
  kind: 'rows'
  host: HTMLElement
  pitch: number
  rowHeight: number
  grabY: number
  left: number
  width: number
}

interface GridSlot { left: number, top: number }

interface GridScene {
  kind: 'grid'
  grid: HTMLElement
  slots: GridSlot[]
  columns: number
  pitchX: number
  pitchY: number
  gridLeft: number
  gridTop: number
  grabX: number
  grabY: number
  width: number
  height: number
}

type Scene = RowsScene | GridScene

interface PlaylistSortOptions {
  ids: () => readonly number[]
  playlistOf: (id: number) => Playlist | undefined
  commit: (ids: readonly number[]) => boolean
  layout: () => 'rows' | 'grid'
}

class PlaylistScene implements DragSortAdapter<Scene> {
  constructor(private readonly layout: () => 'rows' | 'grid') {}

  measure(id: number, handle: HTMLElement, at: Point): Scene | null {
    const card = handle.closest<HTMLElement>('[data-playlist-id]')
    const host = handle.closest<HTMLElement>('[data-playlist-sort]')
    if (!card || !host || !card.isConnected)
      return null
    const rect = card.getBoundingClientRect()
    if (this.layout() === 'rows') {
      const rows = [
...host.querySelectorAll<HTMLElement>('[data-playlist-id]'),
]
      if (rows.length === 0)
        return null
      const pitch = rows.length >= 2
        ? rows[1]!.getBoundingClientRect().top - rows[0]!.getBoundingClientRect().top
        : rect.height + GAP
      return {
        kind: 'rows',
        host,
        pitch: pitch > 0
? pitch
: ROW + GAP,
        rowHeight: rect.height || ROW,
        grabY: at.y - rect.top,
        left: rect.left,
        width: rect.width,
      }
    }

    const cards = [
...host.querySelectorAll<HTMLElement>('[data-playlist-id]'),
]
    const slots = cards.map((element) => {
      const box = element.getBoundingClientRect()
      return { left: box.left + scrollX, top: box.top + scrollY }
    })
    const first = slots[0]
    if (!first || slots.length === 0)
      return null
    const columns = slots.filter(slot => Math.abs(slot.top - first.top) < 1).length
    const pitchX = columns > 1
? slots[1]!.left - first.left
: rect.width + GAP_X
    const pitchY = slots.length > columns
? slots[columns]!.top - first.top
: rect.height + GAP_Y
    return {
      kind: 'grid',
      grid: host,
      slots,
      columns,
      pitchX: pitchX > 0
? pitchX
: rect.width + GAP_X,
      pitchY: pitchY > 0
? pitchY
: rect.height + GAP_Y,
      gridLeft: first.left,
      gridTop: first.top,
      grabX: at.x - (rect.left - GHOST_PAD),
      grabY: at.y - (rect.top - GHOST_PAD),
      width: rect.width + GHOST_PAD * 2,
      height: rect.height + GHOST_PAD * 2,
    }
  }

  track(scene: Scene, at: Point, edges: DragSortEdges, slots: number): DragSortTrack {
    if (scene.kind === 'rows') {
      const listTop = scene.host.getBoundingClientRect().top
      const row = rowTrack({
        grabY: scene.grabY,
        listTop,
        pitch: scene.pitch,
        height: scene.rowHeight,
        minTop: edges.top + 8,
        maxTop: edges.bottom - scene.rowHeight,
      }, at.y, slots)
      return {
ghost: {
x: scene.left,
y: row.y,
width: scene.width,
height: scene.rowHeight,
},
target: row.target,
}
    }
    const grid = scene.grid.getBoundingClientRect()
    const minX = grid.left - GHOST_PAD
    const maxX = Math.max(minX, grid.right - scene.width + GHOST_PAD)
    const minY = edges.top + 8
    const maxY = Math.max(minY, edges.bottom - scene.height)
    const gridTrackResult = gridTrack({
      gridLeft: scene.gridLeft,
      gridTop: scene.gridTop,
      scrollX,
      scrollY,
      pitchX: scene.pitchX,
      pitchY: scene.pitchY,
      columns: scene.columns,
      grabX: scene.grabX,
      grabY: scene.grabY,
      minX,
      maxX,
      minY,
      maxY,
    }, at.x, at.y, slots)
    return {
ghost: {
x: gridTrackResult.x,
y: gridTrackResult.y,
width: scene.width,
height: scene.height,
},
target: gridTrackResult.target,
}
  }

  slot(scene: Scene, target: number): Rect {
    if (scene.kind === 'rows') {
      return {
        x: scene.left,
        y: scene.host.getBoundingClientRect().top + target * scene.pitch,
        width: scene.width,
        height: scene.rowHeight,
      }
    }
    const slot = scene.slots[Math.min(target, scene.slots.length - 1)] ?? scene.slots[0]!
    return {
      x: slot.left - scrollX - GHOST_PAD,
      y: slot.top - scrollY - GHOST_PAD,
      width: scene.width,
      height: scene.height,
    }
  }
}

export class PlaylistSort {
  readonly sort: DragSort<Scene>
  settling = $state(false)
  settleX = $state(0)
  settleY = $state(0)
  private settleTimer: ReturnType<typeof setTimeout> | undefined
  private settlingId = $state<number | null>(null)
  /** 落位期间继续显示松手时的顺序 */
  private settleOrder = $state.raw<readonly number[] | null>(null)

  constructor(private readonly options: PlaylistSortOptions) {
    this.sort = new DragSort<Scene>({
      ids: options.ids,
      adapter: new PlaylistScene(options.layout),
      commit: ids => options.commit(ids),
      busy: () => this.settling,
      onEnd: result => this.settled(result),
    })
  }

  get dragging(): boolean {
    return this.sort.dragging
  }

  /** 平时是 App 里的顺序 */
  get order(): readonly number[] {
    return this.sort.preview ?? this.settleOrder ?? this.options.ids()
  }

  playlistOf(id: number): Playlist | undefined {
    return this.options.playlistOf(id)
  }

  /** 列表里留空位；落位动画播完才露出来 */
  lifted = (id: number): boolean => (this.dragging || this.settling) && this.grabbedId === id

  get grabbedId(): number | null {
    return this.dragging ? this.sort.grabbed : this.settlingId
  }

  get grabbed(): Playlist | null {
    const id = this.grabbedId
    return id === null
? null
: this.options.playlistOf(id) ?? null
  }

  /** 视口坐标；落位时从这里滑到 settleX / settleY */
  get ghost(): Rect {
    return this.sort.ghost
  }

  /** 按住立即拖（鼠标挪过 5px 才算） */
  handle(id: number): Attachment<HTMLElement> {
    return this.sort.handle(id)
  }

  /** Esc、页面藏起来、右键、指针被收回：回到原处，不提交 */
  cancel(): void {
    this.stopSettle()
    this.sort.cancel()
  }

  /** 焦点所在这一张 Alt+↑/↓ 移一位（桌面） */
  moveByKeyboard(id: number, delta: -1 | 1): boolean {
    if (this.dragging || this.settling)
      return false
    return this.sort.moveByKeyboard(id, delta)
  }

  private settled(result: DragSortResult): void {
    this.stopSettle()
    if (result.cancelled)
      return
    // 基线：松手后焦点回到被移动的那一张链接（拖完还能接着 Alt + ↑ / ↓）
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-playlist-id="${result.grabbed}"] a`)?.focus())
    const slot = this.sort.settleAt(result.target)
    if (!slot)
      return
    this.settlingId = result.grabbed
    this.settleOrder = result.order
    this.settleX = slot.x
    this.settleY = slot.y
    this.settling = true
    this.settleTimer = setTimeout(() => {
      this.settleTimer = undefined
      this.settling = false
      this.settlingId = null
      this.settleOrder = null
    }, moveMs(DURATIONS.state))
  }

  private stopSettle(): void {
    if (this.settleTimer !== undefined) {
      clearTimeout(this.settleTimer)
      this.settleTimer = undefined
    }
    this.settling = false
    this.settlingId = null
    this.settleOrder = null
  }
}
