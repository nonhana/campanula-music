import type { Attachment } from 'svelte/attachments';

import type {
  DragSortEdges,
  DragSortResult,
  DragSortSession,
  DragSortState,
  Point,
  Rect,
} from './drag-sort';
import { createDragSortSession } from './drag-sort';
import { attachWindowGrip, createPageHold } from './press';

export interface DragSortTrack {
  ghost: Rect;
  target: number;
}

export interface DragSortAdapter<S> {
  measure: (id: number, handle: HTMLElement, at: Point) => S | null;
  track: (
    scene: S,
    at: Point,
    edges: DragSortEdges,
    slots: number,
  ) => DragSortTrack;
  slot: (scene: S, target: number) => Rect;
}

export interface DragSortOptions<S> {
  ids: () => readonly number[];
  groupOf?: (id: number) => readonly number[];
  adapter: DragSortAdapter<S>;
  commit: (order: readonly number[], state: DragSortState | null) => boolean;
  busy?: () => boolean;
  keyboard?: boolean;
  scrollable?: () => boolean;
  onPointer?: (at: Point) => void;
  onStart?: (state: DragSortState) => void;
  onEnd?: (result: DragSortResult) => void;
}

export class DragSort<S> {
  dragging = $state(false);
  grabbed = $state<number | null>(null);
  preview = $state.raw<readonly number[] | null>(null);
  moving = $state.raw<readonly number[]>([]);
  rest = $state.raw<readonly number[]>([]);
  target = $state(0);
  ghost = $state.raw<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  private scene: S | null = null;
  private tracked: { at: Point; slots: number; result: DragSortTrack } | null =
    null;
  private raf = 0;
  private lastFrame = 0;
  private readonly pageHold = createPageHold();
  private readonly session: DragSortSession;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 每个把手一份、不会逐帧变的接线缓存，不参与渲染
  private readonly handles = new Map<number, Attachment<HTMLElement>>();
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 每个把手挂着的元素，量几何时按编号找
  private readonly elements = new Map<number, HTMLElement>();

  constructor(private readonly options: DragSortOptions<S>) {
    this.session = createDragSortSession<S>({
      ids: options.ids,
      groupOf: options.groupOf,
      begin: (id, at) => {
        const element = this.elements.get(id);
        if (!element) return null;
        const scene = options.adapter.measure(id, element, at);
        if (scene) this.scene = scene;
        return scene;
      },
      targetAt: (scene, at, slots) => this.track(scene, at, slots).target,
      edges: pageEdges,
      commit: options.commit,
      busy: options.busy,
      keyboard: options.keyboard,
      scrollable: options.scrollable,
      onPointer: (at) => {
        this.tracked = null;
        options.onPointer?.(at);
      },
      onChange: (state) => this.sync(state),
      onStart: (state) => {
        this.tracked = null;
        const at = this.session.pointer;
        if (at && this.scene)
          this.setGhost(this.track(this.scene, at, state.rest.length).ghost);
        this.pageHold(true);
        window.addEventListener('keydown', this.onKey, true);
        this.lastFrame = performance.now();
        this.raf = requestAnimationFrame(this.frame);
        options.onStart?.(state);
      },
      onEnd: (result) => {
        this.pageHold(false);
        window.removeEventListener('keydown', this.onKey, true);
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        options.onEnd?.(result);
      },
    });
  }

  handle(id: number): Attachment<HTMLElement> {
    let attachment = this.handles.get(id);
    if (!attachment) {
      attachment = (element) => {
        this.elements.set(id, element);
        const detach = attachWindowGrip(this.session.grip(id))(element);
        return () => {
          if (this.elements.get(id) === element) this.elements.delete(id);
          detach?.();
        };
      };
      this.handles.set(id, attachment);
    }
    return attachment;
  }

  settleAt(target: number): Rect | null {
    return this.scene ? this.options.adapter.slot(this.scene, target) : null;
  }

  cancel(): void {
    this.session.cancel();
  }

  moveByKeyboard(id: number, delta: -1 | 1): boolean {
    return this.session.moveByKeyboard(id, delta);
  }

  private track(scene: S, at: Point, slots: number): DragSortTrack {
    const hit = this.tracked;
    if (hit && hit.at.x === at.x && hit.at.y === at.y && hit.slots === slots)
      return hit.result;
    const result = this.options.adapter.track(scene, at, pageEdges(), slots);
    this.tracked = { at, slots, result };
    return result;
  }

  private setGhost(next: Rect): void {
    const current = this.ghost;
    if (
      current.x !== next.x ||
      current.y !== next.y ||
      current.width !== next.width ||
      current.height !== next.height
    )
      this.ghost = next;
  }

  private sync(state: DragSortState | null): void {
    this.dragging = state !== null;
    this.grabbed = state?.grabbed ?? null;
    this.preview = state?.preview ?? null;
    this.moving = state?.moving ?? [];
    this.rest = state?.rest ?? [];
    this.target = state?.target ?? 0;
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    // 捕获阶段消费：不然同一次 Esc 还会关掉浮层（它在冒泡阶段看 defaultPrevented）
    event.preventDefault();
    event.stopPropagation();
    this.cancel();
  };

  private readonly frame = (now: number): void => {
    if (!this.session.state) {
      this.raf = 0;
      return;
    }
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.tracked = null;
    const amount = this.session.frame(dt);
    if (amount !== 0) window.scrollBy(0, amount);
    const at = this.session.pointer;
    const state = this.session.state;
    if (at && this.scene && state) {
      this.session.track();
      this.setGhost(this.track(this.scene, at, state.rest.length).ghost);
    }
    this.raf = requestAnimationFrame(this.frame);
  };
}

export const pageEdges = (): DragSortEdges => {
  const top =
    document
      .querySelector<HTMLElement>('[data-page-top]')
      ?.getBoundingClientRect().bottom ?? 0;
  const bar =
    document
      .querySelector<HTMLElement>('[data-player-bar]')
      ?.getBoundingClientRect().top ?? window.innerHeight;
  return { top, bottom: bar };
};
