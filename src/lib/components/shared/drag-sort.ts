import { clamp } from './clamp';
import type { Grip, PointerSample } from './press';
import { rightButtonDown } from './press';
import { edgeScroll } from './scroll-edge';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DragSortEdges {
  top: number;
  bottom: number;
}

export interface DragSortState {
  readonly grabbed: number;
  readonly moving: readonly number[];
  readonly rest: readonly number[];
  readonly target: number;
  // 空位没变就不提交（多选非连续时 preview 一开始就和 ids 不同）
  readonly startTarget: number;
  readonly preview: readonly number[];
}

export interface DragSortResult {
  readonly moved: boolean;
  readonly order: readonly number[];
  readonly target: number;
  readonly cancelled: boolean;
  readonly grabbed: number;
}

export interface DragSortSessionOptions<S> {
  ids: () => readonly number[];
  groupOf?: (id: number) => readonly number[];
  begin: (id: number, at: Point) => S | null;
  targetAt: (scene: S, at: Point, slots: number) => number;
  edges: () => DragSortEdges;
  commit: (order: readonly number[], state: DragSortState | null) => boolean;
  busy?: () => boolean;
  keyboard?: boolean;
  scrollable?: () => boolean;
  onPointer?: (at: Point) => void;
  onChange?: (state: DragSortState | null) => void;
  onStart?: (state: DragSortState) => void;
  onEnd?: (result: DragSortResult) => void;
}

export interface DragSortSession {
  readonly state: DragSortState | null;
  readonly pointer: Point | null;
  grip: (id: number) => Grip;
  frame: (dt: number) => number;
  track: () => void;
  cancel: () => void;
  moveByKeyboard: (id: number, delta: -1 | 1) => boolean;
}

const SLOP = 5;

interface Press {
  pointerId: number;
  pending: Point | null;
}

export const createDragSortSession = <S>(
  options: DragSortSessionOptions<S>,
): DragSortSession => {
  let state: DragSortState | null = null;
  let pointer: Point | null = null;
  let scene: S | null = null;
  let press: Press | null = null;
  let holdAtEdge = 0;

  const emit = () => {
    options.onChange?.(state);
  };

  const previewOf = (
    rest: readonly number[],
    moving: readonly number[],
    target: number,
  ): readonly number[] => {
    const next = [...rest];
    next.splice(target, 0, ...moving);
    return next;
  };

  const setTarget = (target: number) => {
    if (!state || !scene || !pointer) return;
    const next = clamp(target, 0, state.rest.length);
    if (next === state.target) return;
    state = {
      ...state,
      target: next,
      preview: previewOf(state.rest, state.moving, next),
    };
    emit();
  };

  const track = () => {
    if (!state || !scene || !pointer) return;
    setTarget(options.targetAt(scene, pointer, state.rest.length));
  };

  const begin = (id: number, at: Point): boolean => {
    if (state) return false;
    const next = options.begin(id, at);
    if (!next) return false;
    const ids = options.ids();
    const index = ids.indexOf(id);
    if (index < 0) {
      scene = null;
      return false;
    }
    const wanted = new Set(options.groupOf?.(id) ?? [id]);
    if (!wanted.has(id)) wanted.add(id);
    const moving = ids.filter((item) => wanted.has(item));
    const rest = ids.filter((item) => !wanted.has(item));
    const before =
      index - ids.slice(0, index).filter((item) => wanted.has(item)).length;
    scene = next;
    pointer = at;
    state = {
      grabbed: id,
      moving,
      rest,
      target: before,
      startTarget: before,
      preview: previewOf(rest, moving, before),
    };
    holdAtEdge = 0;
    options.onStart?.(state);
    emit();
    track();
    return true;
  };

  const end = (result: DragSortResult) => {
    state = null;
    pointer = null;
    scene = null;
    press = null;
    holdAtEdge = 0;
    options.onEnd?.(result);
    emit();
  };

  const cancel = () => {
    if (!state || !pointer) return;
    end({
      moved: false,
      order: state.preview,
      target: state.target,
      cancelled: true,
      grabbed: state.grabbed,
    });
  };

  const release = (sample: PointerSample) => {
    if (!press || press.pointerId !== sample.pointerId) return;
    if (press.pending) {
      press = null;
      return;
    }
    const ended = state;
    if (!ended) return;
    const moved = ended.target !== ended.startTarget;
    press = null;
    if (moved) {
      try {
        options.commit(ended.preview, ended);
      } finally {
        end({
          moved,
          order: ended.preview,
          target: ended.target,
          cancelled: false,
          grabbed: ended.grabbed,
        });
      }
      return;
    }
    end({
      moved,
      order: ended.preview,
      target: ended.target,
      cancelled: false,
      grabbed: ended.grabbed,
    });
  };

  const grip = (id: number): Grip => ({
    get holding() {
      return press !== null;
    },
    press(sample) {
      if (state || options.busy?.()) return false;
      if (!sample.isPrimary || sample.button !== 0) return false;
      if (press) abandon();
      press = {
        pointerId: sample.pointerId,
        pending:
          sample.pointerType === 'touch' ? null : { x: sample.x, y: sample.y },
      };
      if (sample.pointerType !== 'touch') return true;
      const started = begin(id, { x: sample.x, y: sample.y });
      if (!started) press = null;
      return started;
    },
    move(sample) {
      if (!press || press.pointerId !== sample.pointerId) return;
      if (rightButtonDown(sample.buttons)) return abandon();
      const at = { x: sample.x, y: sample.y };
      if (press.pending) {
        if (Math.hypot(at.x - press.pending.x, at.y - press.pending.y) < SLOP)
          return;
        press.pending = null;
        if (!begin(id, at)) {
          press = null;
          return;
        }
      }
      pointer = at;
      options.onPointer?.(at);
      track();
    },
    release(sample) {
      release(sample);
    },
    abandon(pointerId) {
      abandon(pointerId);
    },
    click() {
      return true;
    },
  });

  const abandon = (pointerId?: number) => {
    if (!press) return;
    if (pointerId !== undefined && pointerId !== press.pointerId) return;
    const wasDragging = state !== null;
    press = null;
    if (wasDragging) cancel();
  };

  return {
    get state() {
      return state;
    },
    get pointer() {
      return pointer;
    },
    grip,
    frame(dt) {
      if (!state || !pointer) return 0;
      if (options.scrollable && !options.scrollable()) {
        holdAtEdge = 0;
        return 0;
      }
      const { top, bottom } = options.edges();
      const scroll = edgeScroll(dt, pointer.y, top, bottom, holdAtEdge);
      holdAtEdge = scroll.hold;
      return scroll.amount;
    },
    track,
    cancel,
    moveByKeyboard(id, delta) {
      if (state || options.keyboard === false) return false;
      const next = moveKey(options.ids(), id, delta);
      return next !== null && options.commit(next, null);
    },
  };
};

const neighbor = (
  ids: readonly number[],
  id: number,
  delta: -1 | 1,
): { from: number; to: number } | null => {
  const from = ids.indexOf(id);
  const to = from + delta;
  return from < 0 || to < 0 || to >= ids.length ? null : { from, to };
};

const moveKey = (
  ids: readonly number[],
  id: number,
  delta: -1 | 1,
): readonly number[] | null => {
  const at = neighbor(ids, id, delta);
  if (!at) return null;
  const next = [...ids];
  next.splice(at.from, 1);
  next.splice(at.to, 0, id);
  return next;
};

// 返回挪到这一首前面的编号；null 挪到最后，undefined 挪不动
export const movedBefore = (
  ids: readonly number[],
  id: number,
  delta: -1 | 1,
): number | null | undefined => {
  const at = neighbor(ids, id, delta);
  if (!at) return undefined;
  return delta < 0 ? ids[at.to]! : (ids[at.to + 1] ?? null);
};

export interface RowTrack {
  grabY: number;
  listTop: number;
  pitch: number;
  height: number;
  minTop: number;
  maxTop: number;
}

export const rowTrack = (
  g: RowTrack,
  pointerY: number,
  slots: number,
): { y: number; target: number } => {
  const y = clamp(pointerY - g.grabY, g.minTop, g.maxTop);
  const target = clamp(
    Math.floor((y + g.height / 2 - g.listTop) / g.pitch),
    0,
    slots,
  );
  return { y, target };
};

export interface GridTrack {
  /** 文档坐标；拖动时页面会滚，所以要带上当时的滚动量 */
  gridLeft: number;
  gridTop: number;
  scrollX: number;
  scrollY: number;
  pitchX: number;
  pitchY: number;
  columns: number;
  grabX: number;
  grabY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const gridTrack = (
  g: GridTrack,
  pointerX: number,
  pointerY: number,
  slots: number,
): { x: number; y: number; target: number } => {
  const x = clamp(pointerX - g.grabX, g.minX, g.maxX);
  const y = clamp(pointerY - g.grabY, g.minY, g.maxY);
  const docX = pointerX + g.scrollX;
  const docY = pointerY + g.scrollY;
  const column = clamp(
    Math.floor((docX - g.gridLeft) / g.pitchX),
    0,
    g.columns - 1,
  );
  const row = Math.max(0, Math.floor((docY - g.gridTop) / g.pitchY));
  return {
    x,
    y,
    target: clamp(row * g.columns + column, 0, slots),
  };
};
