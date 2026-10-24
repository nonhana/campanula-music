import type { Attachment } from 'svelte/attachments'

import type { DragSortEdges, DragSortResult, DragSortSession, DragSortState, Point, Rect } from './drag-sort'
import { createDragSortSession } from './drag-sort'
import { attachWindowGrip, createPageHold } from './press'

// 拖动排序的接线（手机歌单行、桌面歌单网格、多选拖歌共用）：rAF 循环、页面保持（光标和选字）、Esc、页边测量只写这一份；
// 手势判断在 drag-sort.ts 的纯核心里，几何适配器只量 DOM（measure / track / slot），浮起的影子由视图画。
// 把手都用 attachWindowGrip：虚拟列表会重建行，move / up 听在 window 上才不会断。

/** 适配器每帧算一次 */
export interface DragSortTrack {
  ghost: Rect
  target: number
}

export interface DragSortAdapter<S> {
  /** 量一次；元素不在了返回 null */
  measure: (id: number, handle: HTMLElement, at: Point) => S | null
  /** edges 是页面上沿、下沿，slots 是没被拿走的个数 */
  track: (scene: S, at: Point, edges: DragSortEdges, slots: number) => DragSortTrack
  /** 落位时空位在视口的哪里 */
  slot: (scene: S, target: number) => Rect
}

export interface DragSortOptions<S> {
  ids: () => readonly number[]
  groupOf?: (id: number) => readonly number[]
  adapter: DragSortAdapter<S>
  commit: (order: readonly number[], state: DragSortState | null) => boolean
  busy?: () => boolean
  keyboard?: boolean
  scrollable?: () => boolean
  /** 每次 pointermove；快速定位这类布局自己的东西在这里更新 */
  onPointer?: (at: Point) => void
  onStart?: (state: DragSortState) => void
  onEnd?: (result: DragSortResult) => void
}

export class DragSort<S> {
  dragging = $state(false)
  grabbed = $state<number | null>(null)
  preview = $state.raw<readonly number[] | null>(null)
  moving = $state.raw<readonly number[]>([])
  rest = $state.raw<readonly number[]>([])
  target = $state(0)
  /** 落位动画从这里出发 */
  ghost = $state.raw<Rect>({ x: 0, y: 0, width: 0, height: 0 })
  private scene: S | null = null
  /** target 和 ghost 共用一次 adapter.track / pageEdges */
  private tracked: { at: Point, slots: number, result: DragSortTrack } | null = null
  private raf = 0
  private lastFrame = 0
  private readonly pageHold = createPageHold()
  private readonly session: DragSortSession
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 每个把手一份、不会逐帧变的接线缓存，不参与渲染
  private readonly handles = new Map<number, Attachment<HTMLElement>>()
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 每个把手挂着的元素，量几何时按编号找
  private readonly elements = new Map<number, HTMLElement>()

  constructor(private readonly options: DragSortOptions<S>) {
    this.session = createDragSortSession<S>({
      ids: options.ids,
      groupOf: options.groupOf,
      begin: (id, at) => {
        const element = this.elements.get(id)
        if (!element)
          return null
        const scene = options.adapter.measure(id, element, at)
        if (scene)
          this.scene = scene
        return scene
      },
      targetAt: (scene, at, slots) => this.track(scene, at, slots).target,
      edges: pageEdges,
      commit: options.commit,
      busy: options.busy,
      keyboard: options.keyboard,
      scrollable: options.scrollable,
      onPointer: (at) => {
        // 指针动了：上一帧的几何不能再用（快速定位还会先滚一下）
        this.tracked = null
        options.onPointer?.(at)
      },
      onChange: state => this.sync(state),
      onStart: (state) => {
        this.tracked = null
        const at = this.session.pointer
        if (at && this.scene)
          this.setGhost(this.track(this.scene, at, state.rest.length).ghost)
        this.pageHold(true)
        window.addEventListener('keydown', this.onKey, true)
        this.lastFrame = performance.now()
        this.raf = requestAnimationFrame(this.frame)
        options.onStart?.(state)
      },
      onEnd: (result) => {
        this.pageHold(false)
        window.removeEventListener('keydown', this.onKey, true)
        cancelAnimationFrame(this.raf)
        this.raf = 0
        options.onEnd?.(result)
      },
    })
  }

  /** 鼠标挪过 5px 才算，触屏立即 */
  handle(id: number): Attachment<HTMLElement> {
    let attachment = this.handles.get(id)
    if (!attachment) {
      attachment = (element) => {
        this.elements.set(id, element)
        const detach = attachWindowGrip(this.session.grip(id))(element)
        return () => {
          if (this.elements.get(id) === element)
            this.elements.delete(id)
          detach?.()
        }
      }
      this.handles.set(id, attachment)
    }
    return attachment
  }

  /** scene 保留到下一次按下，落位动画期间还能用 */
  settleAt(target: number): Rect | null {
    return this.scene
? this.options.adapter.slot(this.scene, target)
: null
  }

  cancel(): void {
    this.session.cancel()
  }

  moveByKeyboard(id: number, delta: -1 | 1): boolean {
    return this.session.moveByKeyboard(id, delta)
  }

  private track(scene: S, at: Point, slots: number): DragSortTrack {
    const hit = this.tracked
    if (hit && hit.at.x === at.x && hit.at.y === at.y && hit.slots === slots)
      return hit.result
    const result = this.options.adapter.track(scene, at, pageEdges(), slots)
    this.tracked = { at, slots, result }
    return result
  }

  private setGhost(next: Rect): void {
    const current = this.ghost
    if (current.x !== next.x || current.y !== next.y || current.width !== next.width || current.height !== next.height)
      this.ghost = next
  }

  private sync(state: DragSortState | null): void {
    this.dragging = state !== null
    this.grabbed = state?.grabbed ?? null
    this.preview = state?.preview ?? null
    this.moving = state?.moving ?? []
    this.rest = state?.rest ?? []
    this.target = state?.target ?? 0
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape')
      return
    // 捕获阶段消费：同一次 Esc 不能既取消拖动又关浮层（OverlayHost 在冒泡阶段尊重 defaultPrevented）
    event.preventDefault()
    event.stopPropagation()
    this.cancel()
  }

  private readonly frame = (now: number): void => {
    if (!this.session.state) {
      this.raf = 0
      return
    }
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    this.tracked = null
    const amount = this.session.frame(dt)
    // 自动滚动仍由浏览器滚（ADR-0012）：核心只说这一帧要滚多少
    if (amount !== 0)
      window.scrollBy(0, amount)
    const at = this.session.pointer
    const state = this.session.state
    if (at && this.scene && state) {
      this.session.track()
      this.setGhost(this.track(this.scene, at, state.rest.length).ghost)
    }
    this.raf = requestAnimationFrame(this.frame)
  }
}

/** 页面上沿：吸在顶上的顶栏下沿；下沿：迷你播放条 / 底部操作条 / 桌面播放条的上沿 */
export const pageEdges = (): DragSortEdges => {
  const top = document.querySelector<HTMLElement>('[data-page-top]')?.getBoundingClientRect().bottom ?? 0
  const bar = document.querySelector<HTMLElement>('[data-player-bar]')?.getBoundingClientRect().top ?? window.innerHeight
  return { top, bottom: bar }
}
