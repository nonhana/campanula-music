import type { Attachment } from 'svelte/attachments'
import type { Playlist } from '#lib/api/library.js'
import { moveMs } from '../motion'
import { DURATIONS } from '../motion-tokens'
import { attachWindowGrip, createPageHold } from '../press'
import { edgeScroll } from '../scroll-edge'

// 曲库里自建歌单之间的排序（#37，原型 docs/prototype/dnd.md 方案 C 的曲库部分）：
// 点“排序”进入，列表每行右边的把手按住立即拖；松手提交，点“完成”退出。
// - 只有自建歌单参与；我喜欢的音乐固定在最前，收藏的歌单不参与（由 App 的 orderPlaylists 保证）
// - 拖到上下边缘自动滚动：越深越快，停在边缘越久越快（和歌曲列表同一套参数）
// - 拖动中按 Esc 取消；焦点在某一行时 Alt + ↑ / ↓ 移一位，走同一个 commit
// - 列表很短（几十张），不做快速定位窄条；浮起的行跟着指针，原位置留一道浅薄荷空位

/** 一行的高度（px，DESIGN.md Song Row） */
const ROW = 56
/** 行与行之间（px） */
const GAP = 8

interface PlaylistSortOptions {
  /** 当前顺序（只有自建歌单的编号） */
  ids: () => readonly number[]
  /** 编号对应的歌单，用来画浮起的那一行 */
  playlistOf: (id: number) => Playlist | undefined
  /** 松手、键盘移动：提交新的顺序。App 返回顺序有没有改 */
  commit: (ids: readonly number[]) => boolean
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

export class PlaylistSort {
  /** 正在拖着 */
  dragging = $state(false)
  /** 松手后浮起的行正落进空位 */
  settling = $state(false)
  /** 拖动中显示的顺序；不在拖动时是 null */
  preview = $state.raw<readonly number[] | null>(null)
  /** 手指按住的那一张：浮起的行显示它 */
  grabbed = $state.raw<Playlist | null>(null)
  /** 浮起的行跟到哪（视口坐标） */
  ghostY = $state(0)
  ghostLeft = $state(0)
  ghostWidth = $state(0)
  /** 落位时浮起的行去哪里 */
  settleY = $state(0)
  private pointer: number | null = null
  private grabY = 0
  private pointerY = 0
  private startIds: readonly number[] = []
  private startTarget = 0
  private target = 0
  private pitch = ROW + GAP
  private listTop = 0
  private raf = 0
  private lastFrame = 0
  private holdAtEdge = 0
  private settleTimer: ReturnType<typeof setTimeout> | undefined
  private readonly pageHold = createPageHold()
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 每个把手一份、不会逐帧变的接线缓存，不参与渲染
  private readonly handles = new Map<number, Attachment<HTMLElement>>()

  constructor(private readonly options: PlaylistSortOptions) {}

  /** 拖动中列表显示的顺序（预览），平时是 App 里的顺序 */
  get order(): readonly number[] {
    return this.preview ?? this.options.ids()
  }

  /** 编号对应的歌单（浮起的行、给读屏的说明用） */
  playlistOf(id: number): Playlist | undefined {
    return this.options.playlistOf(id)
  }

  /** 这一行是不是被拿起来了（列表里留空位）：落位动画播完才露出来 */
  lifted = (id: number): boolean => (this.dragging || this.settling) && this.grabbed?.id === id

  /** 列表容器：拖动时按它和每一行的高度算落点 */
  readonly container: Attachment<HTMLElement> = (element) => {
    const measure = () => {
      const rows = [...element.querySelectorAll<HTMLElement>('[data-playlist-id]')]
      if (rows.length >= 2)
        this.pitch = rows[1]!.getBoundingClientRect().top - rows[0]!.getBoundingClientRect().top
      else if (rows.length === 1)
        this.pitch = rows[0]!.getBoundingClientRect().height + GAP
      this.listTop = element.getBoundingClientRect().top
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }

  /** 把手：按住立即拖（触屏、鼠标都一样，鼠标挪过 5px 才算） */
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
    const row = handle.closest<HTMLElement>('[data-playlist-id]')
    if (!playlist || !row || !row.isConnected)
      return false
    const ids = this.options.ids()
    const index = ids.indexOf(id)
    if (index < 0)
      return false
    const host = row.parentElement
    if (!host)
      return false
    const rowRect = row.getBoundingClientRect()
    this.startIds = ids
    this.preview = ids
    this.grabbed = playlist
    this.target = index
    this.startTarget = index
    this.grabY = sample.y - rowRect.top
    this.pointerY = sample.y
    this.ghostY = rowRect.top
    this.ghostLeft = rowRect.left
    this.ghostWidth = rowRect.width
    this.listTop = host.getBoundingClientRect().top
    this.pitch = this.pitchOf(host)
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

  private move(sample: { pointerId: number, x: number, y: number }): void {
    if (sample.pointerId !== this.pointer || this.settling)
      return
    this.pointerY = sample.y
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
    const slotY = this.listTop + this.target * this.pitch
    this.settling = true
    this.settleY = slotY
    this.settleTimer = setTimeout(() => {
      this.settleTimer = undefined
      this.settling = false
      this.preview = null
      this.grabbed = null
    }, moveMs(DURATIONS.state))
    if (moved)
      this.options.commit(next)
  }

  /** 拖动作废（Esc、页面藏起来、右键、指针被收回）：回到原处，什么都不提交 */
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

  /** 键盘：焦点所在这一张 Alt + ↑ / ↓ 移一位（桌面） */
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

  private pitchOf(host: HTMLElement): number {
    const rows = [...host.querySelectorAll<HTMLElement>('[data-playlist-id]')]
    if (rows.length >= 2)
      return rows[1]!.getBoundingClientRect().top - rows[0]!.getBoundingClientRect().top
    return rows[0] ? rows[0].getBoundingClientRect().height + GAP : ROW + GAP
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

  private readonly frame = (now: number): void => {
    if (!this.dragging) {
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
    this.ghostY = clamp(this.pointerY - this.grabY, top + 8, bottom - ROW)
    const host = document.querySelector<HTMLElement>('[data-playlist-sort]')
    if (host)
      this.listTop = host.getBoundingClientRect().top
    const center = this.ghostY + ROW / 2 - this.listTop
    const target = clamp(Math.floor(center / this.pitch), 0, this.startIds.length - 1)
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
