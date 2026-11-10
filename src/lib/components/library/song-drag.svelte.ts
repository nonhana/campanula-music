import type { Attachment } from 'svelte/attachments';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';

import type { Song } from '#lib/api/library.js';

import { clamp } from '../shared/clamp';
import type {
  DragSortEdges,
  DragSortResult,
  DragSortState,
  Point,
  Rect,
} from '../shared/drag-sort';
import { movedBefore, rowTrack } from '../shared/drag-sort';
import { DragSort, pageEdges } from '../shared/drag-sort.svelte';
import { DURATIONS, STAGGER } from '../shared/motion-tokens';
import { formatCount } from '../shared/text';
import { SONG_ROW_HEIGHT } from '../songs/view';
import type { MultiSelect } from './multi-select.svelte';

// 被拖的行必须一直挂载（keep）：Android 上手指底下的元素被卸载后触摸事件会断

const ROW = SONG_ROW_HEIGHT;
const RAIL = 44;
const LABEL_GAP = 14;
const LIFT_MS = DURATIONS.state;
const SETTLE_MS = DURATIONS.state;
const EXPAND_MS = DURATIONS.state;
const EXPAND_STAGGER = STAGGER.step;

interface SongDragOptions {
  songs: () => readonly Song[];
  selection: MultiSelect;
  /** null 是挪到最后 */
  move: (songIds: readonly number[], before: number | null) => boolean;
  host: () => HTMLElement | undefined;
}

interface SongScene {
  grabY: number;
  left: number;
  width: number;
  height: number;
}

export class SongDrag {
  private readonly sort: DragSort<SongScene>;
  dragging = $state(false);
  lifting = $state(false);
  settling = $state(false);
  expanding = $state(false);
  scrubbing = $state(false);
  railTop = $state(0);
  railBottom = $state(0);
  settleY = $state(0);
  private movingIds = $state.raw<ReadonlySet<number>>(new SvelteSet<number>());
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 一次拖动用的查找表，不参与渲染
  private readonly byId = new Map<number, Song>();
  private movingSongs: readonly Song[] = [];
  private grabbedSong: Song | null = null;
  private restIndex = new SvelteMap<number, number>();
  private railArmed = false;
  private scrubTarget = 0;
  private pointerX = 0;
  private scrollAdjust = 0;
  private commitOk = true;
  private liftTimer: ReturnType<typeof setTimeout> | undefined;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private expandTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly options: SongDragOptions) {
    this.sort = new DragSort<SongScene>({
      ids: () => this.options.songs().map((song) => song.id),
      groupOf: (id) => this.groupOf(id),
      adapter: {
        measure: (id, handle, at) => this.measure(id, handle, at),
        track: (scene, at, edges, slots) => this.track(scene, at, edges, slots),
        slot: (scene, target) => this.slot(scene, target),
      },
      commit: (_order, state) => {
        if (!state) return false;
        this.commitOk = this.options.move(
          state.moving,
          state.rest[state.target] ?? null,
        );
        return this.commitOk;
      },
      busy: () => this.settling || this.expanding,
      // 键盘 Alt+↑/↓ 走 App.moveSongs，不用核心的“整张顺序提交”
      keyboard: false,
      scrollable: () => !this.scrubbing,
      onPointer: (at) => this.pointer(at),
      onStart: (state) => this.started(state),
      onEnd: (result) => this.ended(result),
    });
  }

  get moved(): readonly Song[] {
    return this.movingSongs;
  }

  get rest(): readonly Song[] {
    return this.sort.rest
      .map((id) => this.byId.get(id))
      .filter((song) => song !== undefined);
  }

  get grabbed(): Song | null {
    return this.grabbedSong;
  }

  get target(): number {
    return this.sort.target;
  }

  get ghostY(): number {
    return this.sort.ghost.y;
  }

  get ghostLeft(): number {
    return this.sort.ghost.x;
  }

  get ghostWidth(): number {
    return this.sort.ghost.width;
  }

  placeOf = (song: Song, index: number): number => {
    if (!this.dragging || this.movingIds.has(song.id)) return index * ROW;
    const rest = this.restIndex.get(song.id)!;
    return (rest < this.sort.target ? rest : rest + 1) * ROW;
  };

  keep = (song: Song): boolean => this.sorting && this.movingIds.has(song.id);

  hideMoved = (song: Song): boolean =>
    this.keep(song) && !this.lifting && !this.expanding;

  motionOf(song: Song): 'pick' | 'land' | null {
    if (!this.movingIds.has(song.id)) return null;
    return this.expanding ? 'land' : 'pick';
  }

  liftShift(index: number): number {
    if (!this.lifting) return 0;
    return this.sort.ghost.y - (this.listTop() + index * ROW);
  }

  landShift(song: Song): number {
    if (!this.expanding) return 0;
    const k = this.moved.findIndex((item) => item.id === song.id);
    return k < 0 ? 0 : -k * ROW;
  }

  landDelay(song: Song): number {
    if (!this.expanding) return 0;
    const k = this.moved.findIndex((item) => item.id === song.id);
    return k < 0 ? 0 : k * EXPAND_STAGGER;
  }

  get sorting(): boolean {
    return this.dragging || this.settling || this.expanding;
  }

  get ghostSong(): Song | null {
    return this.grabbed ?? this.moved[0] ?? null;
  }

  get position(): number {
    return this.sort.target + 1;
  }

  get label(): string {
    return `第 ${formatCount(this.position)} 首`;
  }

  get railTotal(): number {
    return this.rest.length + 1;
  }

  handle(song: Song): Attachment<HTMLElement> {
    return this.sort.handle(song.id);
  }

  cancel(): void {
    this.stopTimers();
    this.sort.cancel();
    this.reset();
  }

  moveByKeyboard(songId: number, delta: -1 | 1): boolean {
    if (this.sorting) return false;
    const list = this.options.songs();
    const before = movedBefore(
      list.map((song) => song.id),
      songId,
      delta,
    );
    if (before === undefined) return false;
    return this.options.move([songId], before);
  }

  private groupOf(id: number): readonly number[] {
    const list = this.options.songs();
    const song = list.find((item) => item.id === id);
    if (
      !song ||
      !this.options.selection.mode ||
      !this.options.selection.has(id) ||
      this.options.selection.size <= 1
    )
      return [id];
    return list
      .filter((item) => this.options.selection.has(item.id))
      .map((item) => item.id);
  }

  private measure(
    id: number,
    handle: HTMLElement,
    at: Point,
  ): SongScene | null {
    const list = this.options.songs();
    const index = list.findIndex((song) => song.id === id);
    if (index < 0) return null;
    // 还没挪够 5px 时多选退出了、行被虚拟列表卸掉了：这次按住不算
    if (!this.options.selection.mode || !handle.isConnected) return null;
    const row = handle.closest<HTMLElement>('[data-song-id]') ?? handle;
    const rect = row.getBoundingClientRect();
    const host = this.options.host();
    if (!host) return null;
    const hostRect = host.getBoundingClientRect();
    this.byId.clear();
    for (const song of list) this.byId.set(song.id, song);
    // 一起拖的几首前面也有被拿走的行：页面往回滚同样的高度，手指底下的空隙不跳
    const wanted = new SvelteSet(this.groupOf(id));
    const before = list
      .slice(0, index)
      .filter((song) => wanted.has(song.id)).length;
    const scrollTop = window.scrollY;
    if (before) window.scrollBy(0, -before * ROW);
    this.scrollAdjust = window.scrollY - scrollTop;
    this.startedInRail(at.x);
    const edges = pageEdges();
    this.railTop = edges.top + 8;
    this.railBottom = window.innerHeight - edges.bottom + 8;
    return {
      grabY: at.y - rect.top,
      left: hostRect.left,
      width: hostRect.width,
      height: ROW,
    };
  }

  private track(
    scene: SongScene,
    at: Point,
    edges: DragSortEdges,
    slots: number,
  ): { ghost: Rect; target: number } {
    if (this.scrubbing) {
      const target = clamp(this.scrubTarget, 0, slots);
      return {
        ghost: {
          x: scene.left,
          y: this.listTop() + target * ROW,
          width: scene.width,
          height: ROW,
        },
        target,
      };
    }
    const row = rowTrack(
      {
        grabY: scene.grabY,
        listTop: this.listTop(),
        pitch: ROW,
        height: ROW,
        minTop: edges.top + LABEL_GAP,
        maxTop: edges.bottom - ROW,
      },
      at.y,
      slots,
    );
    return {
      ghost: {
        x: scene.left,
        y: row.y,
        width: scene.width,
        height: ROW,
      },
      target: row.target,
    };
  }

  private slot(scene: SongScene, target: number): Rect {
    return {
      x: scene.left,
      y: this.listTop() + target * ROW,
      width: scene.width,
      height: scene.height,
    };
  }

  private started(state: DragSortState): void {
    this.dragging = true;
    this.lifting = true;
    this.settling = false;
    this.expanding = false;
    this.commitOk = true;
    this.movingIds = new SvelteSet(state.moving);
    this.movingSongs = state.moving
      .map((id) => this.byId.get(id))
      .filter((song) => song !== undefined);
    this.grabbedSong = this.byId.get(state.grabbed) ?? null;
    this.restIndex = new SvelteMap(
      state.rest.map((id, index) => [id, index] as const),
    );
    this.liftTimer = setTimeout(() => {
      this.liftTimer = undefined;
      this.lifting = false;
    }, LIFT_MS);
  }

  private ended(result: DragSortResult): void {
    this.dragging = false;
    this.stopTimers();
    this.lifting = false;
    if (result.cancelled || !result.moved || !this.commitOk) {
      this.undoScroll();
      this.reset();
      return;
    }
    this.scrollAdjust = 0;
    this.settling = true;
    this.expanding = false;
    this.settleY =
      this.sort.settleAt(result.target)?.y ??
      this.listTop() + result.target * ROW;
    this.settleTimer = setTimeout(() => {
      this.settleTimer = undefined;
      this.settling = false;
      this.expanding = true;
      this.expandTimer = setTimeout(
        () => {
          this.expandTimer = undefined;
          this.expanding = false;
          this.reset();
        },
        EXPAND_MS + Math.max(0, this.moved.length - 1) * EXPAND_STAGGER,
      );
    }, SETTLE_MS);
  }

  private pointer(at: Point): void {
    this.pointerX = at.x;
    if (this.settling || this.expanding) return;
    const railLeft = window.innerWidth - RAIL;
    if (!this.railArmed) {
      // 从窄条里开始的拖动：先往左离开窄条，快速定位才接手（手机上把手正好在窄条里）
      if (this.pointerX < railLeft - 24) this.railArmed = true;
      return;
    }
    if (!this.scrubbing && this.pointerX > railLeft) {
      this.scrubbing = true;
      this.scrubTo(at.y);
    } else if (this.scrubbing && this.pointerX < railLeft - 24) {
      this.scrubbing = false;
    }
    if (this.scrubbing) this.scrubTo(at.y);
  }

  private scrubTo(y: number): void {
    // 和窄条对齐：窄条上下各留 8px，轨道再缩进 24px 放首尾的数字
    const trackTop = this.railTop + 24;
    const trackBottom = window.innerHeight - this.railBottom - 24;
    const ratio = clamp(
      (y - trackTop) / Math.max(1, trackBottom - trackTop),
      0,
      1,
    );
    this.scrubTarget = Math.round(ratio * this.rest.length);
    const edges = pageEdges();
    const middle = (edges.top + edges.bottom) / 2;
    const hostTop = this.listTop() + window.scrollY;
    window.scrollTo({
      top: hostTop + this.scrubTarget * ROW + ROW / 2 - middle,
    });
  }

  private startedInRail(x: number): void {
    const inRail = x >= window.innerWidth - RAIL;
    this.railArmed = !inRail;
    this.scrubbing = false;
  }

  private stopTimers(): void {
    if (this.liftTimer !== undefined) {
      clearTimeout(this.liftTimer);
      this.liftTimer = undefined;
    }
    if (this.settleTimer !== undefined) {
      clearTimeout(this.settleTimer);
      this.settleTimer = undefined;
    }
    if (this.expandTimer !== undefined) {
      clearTimeout(this.expandTimer);
      this.expandTimer = undefined;
    }
  }

  private undoScroll(): void {
    if (this.scrollAdjust === 0) return;
    window.scrollBy(0, -this.scrollAdjust);
    this.scrollAdjust = 0;
  }

  private reset(): void {
    this.stopTimers();
    this.dragging = false;
    this.lifting = false;
    this.settling = false;
    this.expanding = false;
    this.scrubbing = false;
    this.movingIds = new SvelteSet<number>();
    this.movingSongs = [];
    this.grabbedSong = null;
    this.restIndex = new SvelteMap();
    this.scrollAdjust = 0;
    this.byId.clear();
  }

  private listTop(): number {
    return this.options.host()?.getBoundingClientRect().top ?? 0;
  }
}
