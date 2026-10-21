import type { Attachment } from 'svelte/attachments'
import type { Playlist } from '#lib/api/library.js'
import { moveMs } from '../motion'
import { DURATIONS } from '../motion-tokens'
import { attachWindowGrip, createPageHold } from '../press'
import { edgeScroll } from '../scroll-edge'

// 桌面的曲库歌单排序（#37）：保持原来的网格卡片，每张封面的右上角一个把手；按住把手拖，
// 卡片跟着指针走，原来的位置留浅薄荷封面空位，其余卡片让位。和手机列表共用同一个提交规则。
// 落点按网格的格位算（不是按某张卡片现在在 DOM 里的位置），所以卡片换位时不会抖；
// 拖到上下边缘自动滚动；Esc 取消；焦点在某一格时 Alt + ↑ / ↓ 移一位。

/** 浮起的卡片比原来那张四周多出来的白色衬边（px） */
const GHOST_PAD = 8
const GAP_X = 20
const GAP_Y = 24

interface Slot {
  left: number
  top: number
  width: number
  height: number
}

interface PlaylistGridSortOptions {
  ids: () => readonly number[]
  playlistOf: (id: number) => Playlist | undefined
  commit: (ids: readonly number[]) => boolean
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

export class PlaylistGridSort {
  dragging = $state(false)
  settling = $state(false)
  preview = $state.raw<readonly number[] | null>(null)
  grabbed = $state.raw<Playlist | null>(null)
  /** 浮起的卡片（视口坐标，左上角） */
  ghostX = $state(0)
  ghostY = $state(0)
  ghostWidth = $state(0)
  ghostHeight = $state(0)
  /** 落位时浮起的卡片去哪里 */
  settleX = $state(0)
  settleY = $state(0)
  private pointer: number | null = null
  private grabX = 0
  private grabY = 0
  private pointerX = 0
  private pointerY = 0
  private startIds: readonly number[] = []
  private target = 0
  private slots: Slot[] = []
  private columns = 1
  private pitchX = 0
  private pitchY = 0
  private gridLeft = 0
  private gridTop = 0
  private grid: HTMLElement | null = null
  private raf = 0
  private lastFrame = 0
  private holdAtEdge = 0
  private settleTimer: ReturnType<typeof setTimeout> | undefined
  private readonly pageHold = createPageHold()
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 每个把手一份、不会逐帧变的接线缓存，不参与渲染
  private readonly handles = new Map<number, Attachment<HTMLElement>>()

  constructor(private readonly options: PlaylistGridSortOptions) {}

  readonly container: Attachment<HTMLElement> = (element) => {
    this.grid = element
  }

  get order(): readonly number[] {
    return this.preview ?? this.options.ids()
  }

  playlistOf(id: number): Playlist | undefined {
    return this.options.playlistOf(id)
  }

  /** 这一张是不是被拿起来了（网格里留薄荷空位） */
  lifted = (id: number): boolean => (this.dragging || this.settling) && this.grabbed?.id === id

  handle(id: number): Attachment<HTMLElement> {
    let attachment = this.handles.get(id)
    if (!attachment) {
      attachment = (element) => {
        let pressed = false
        let activePointer: number | null = null
        let pending: { x: number, y: number } | null = null
        return attachWindowGrip({
          get holding() {
            return pressed
          },
          press: (sample) => {
            if (pressed || this.dragging || this.settling || sample.button !== 0)
              return false
            activePointer = sample.pointerId
            if (sample.pointerType === 'mouse') {
              pressed = true
              pending = { x: sample.x, y: sample.y }
              return true
            }
            const started = this.start(id, element, sample)
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
              if (!this.start(id, element, sample)) {
                pressed = false
                activePointer = null
                return
              }
            }
            this.pointerX = sample.x
            this.pointerY = sample.y
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
            this.cancel()
          },
          click: () => {},
        })(element)
      }
      this.handles.set(id, attachment)
    }
    return attachment
  }

  private start(id: number, handle: HTMLElement, sample: { pointerId: number, x: number, y: number }): boolean {
    if (this.dragging || this.settling)
      return false
    const playlist = this.options.playlistOf(id)
    const card = handle.closest<HTMLElement>('[data-playlist-id]')
    const grid = handle.closest<HTMLElement>('[data-playlist-sort]')
    if (!playlist || !card || !grid || !card.isConnected)
      return false
    const ids = this.options.ids()
    const index = ids.indexOf(id)
    if (index < 0)
      return false
    const rect = card.getBoundingClientRect()
    const cards = [...grid.querySelectorAll<HTMLElement>('[data-playlist-id]')]
    const slots = cards.map((element) => {
      const box = element.getBoundingClientRect()
      return { left: box.left + scrollX, top: box.top + scrollY, width: box.width, height: box.height }
    })
    const first = slots[0]
    if (!first)
      return false
    const firstTop = first.top
    const columns = slots.filter(slot => Math.abs(slot.top - firstTop) < 1).length
    const pitchX = columns > 1 ? slots[1]!.left - first.left : first.width + GAP_X
    const pitchY = slots.length > columns ? slots[columns]!.top - first.top : first.height + GAP_Y
    this.startIds = ids
    this.preview = ids
    this.grabbed = playlist
    this.target = index
    this.slots = slots
    this.columns = columns
    this.pitchX = pitchX
    this.pitchY = pitchY
    this.gridLeft = first.left
    this.gridTop = first.top
    this.grid = grid
    this.grabX = sample.x - (rect.left - GHOST_PAD)
    this.grabY = sample.y - (rect.top - GHOST_PAD)
    this.ghostWidth = rect.width + GHOST_PAD * 2
    this.ghostHeight = rect.height + GHOST_PAD * 2
    this.ghostX = rect.left - GHOST_PAD
    this.ghostY = rect.top - GHOST_PAD
    this.pointerX = sample.x
    this.pointerY = sample.y
    this.pointer = sample.pointerId
    this.dragging = true
    this.settling = false
    this.holdAtEdge = 0
    this.pageHold(true)
    window.addEventListener('keydown', this.onKey, true)
    this.lastFrame = performance.now()
    this.raf = requestAnimationFrame(this.frame)
    return true
  }

  private release(): void {
    if (this.pointer === null || !this.dragging)
      return
    this.pointer = null
    this.stopFrame()
    this.pageHold(false)
    const next = this.preview ?? this.startIds
    const moved = next.join() !== this.startIds.join()
    this.dragging = false
    const id = this.grabbed?.id
    if (id !== undefined)
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-playlist-id="${id}"] a`)?.focus())
    const slot = this.slots[this.target]
    this.settling = true
    if (slot) {
      this.settleX = slot.left - scrollX - GHOST_PAD
      this.settleY = slot.top - scrollY - GHOST_PAD
    }
    this.settleTimer = setTimeout(() => {
      this.settleTimer = undefined
      this.settling = false
      this.preview = null
      this.grabbed = null
    }, moveMs(DURATIONS.state))
    if (moved)
      this.options.commit(next)
  }

  cancel(): void {
    if (this.settleTimer !== undefined) {
      clearTimeout(this.settleTimer)
      this.settleTimer = undefined
    }
    this.stopFrame()
    this.pointer = null
    this.pageHold(false)
    this.dragging = false
    this.settling = false
    this.preview = null
    this.grabbed = null
  }

  moveByKeyboard(id: number, delta: -1 | 1): boolean {
    if (this.dragging || this.settling)
      return false
    const ids = [...this.options.ids()]
    const from = ids.indexOf(id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= ids.length)
      return false
    ids.splice(from, 1)
    ids.splice(to, 0, id)
    return this.options.commit(ids)
  }

  private stopFrame(): void {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.onKey, true)
    this.holdAtEdge = 0
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape')
      return
    event.preventDefault()
    event.stopPropagation()
    this.cancel()
  }

  private topEdge(): number {
    const top = document.querySelector<HTMLElement>('[data-page-top]')
    return top?.getBoundingClientRect().bottom ?? 0
  }

  private bottomEdge(): number {
    const bar = document.querySelector<HTMLElement>('[data-player-bar]')
    return bar?.getBoundingClientRect().top ?? window.innerHeight
  }

  private readonly frame = (now: number): void => {
    if (!this.dragging || !this.grid) {
      this.raf = 0
      return
    }
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    const top = this.topEdge()
    const bottom = this.bottomEdge()
    const scroll = edgeScroll(dt, this.pointerY, top, bottom, this.holdAtEdge)
    this.holdAtEdge = scroll.hold
    if (scroll.amount !== 0)
      window.scrollBy(0, scroll.amount)
    const grid = this.grid.getBoundingClientRect()
    const minX = grid.left - GHOST_PAD
    const maxX = Math.max(minX, grid.right - this.ghostWidth + GHOST_PAD)
    const minY = top + 8
    const maxY = Math.max(minY, bottom - this.ghostHeight)
    this.ghostX = clamp(this.pointerX - this.grabX, minX, maxX)
    this.ghostY = clamp(this.pointerY - this.grabY, minY, maxY)
    const docX = this.pointerX + scrollX
    const docY = this.pointerY + scrollY
    const column = clamp(Math.floor((docX - this.gridLeft) / this.pitchX), 0, this.columns - 1)
    const row = Math.max(0, Math.floor((docY - this.gridTop) / this.pitchY))
    const target = clamp(row * this.columns + column, 0, this.startIds.length - 1)
    if (target !== this.target) {
      this.target = target
      const current = [...(this.preview ?? this.startIds)]
      const from = current.indexOf(this.grabbed?.id ?? -1)
      if (from >= 0) {
        current.splice(from, 1)
        current.splice(target, 0, this.grabbed!.id)
        this.preview = current
      }
    }
    this.raf = requestAnimationFrame(this.frame)
  }
}
