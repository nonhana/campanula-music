export interface OverlayMarker {
  readonly session: string;
  readonly ids: readonly number[];
  readonly stamp?: string;
}

export interface OverlayPosition {
  readonly cursor: number;
  readonly url: string;
  readonly marker?: OverlayMarker;
  readonly stamp?: string;
}

export type OverlayDestination = string;
export type OverlayResult = 'committed' | 'cancelled' | 'invalidated';
export type HistoryResult =
  | { readonly status: OverlayResult; readonly position: OverlayPosition }
  | {
      readonly status: 'failed';
      readonly position: OverlayPosition;
      readonly error: unknown;
    };

export interface OverlayHistory {
  read: () => OverlayPosition;
  write: (
    marker: OverlayMarker | undefined,
    replace: boolean,
    from: OverlayPosition,
  ) => Promise<HistoryResult>;
  go: (
    target: OverlayPosition,
    from: OverlayPosition,
  ) => Promise<HistoryResult>;
  leave: (
    path: OverlayDestination,
    replace: boolean,
    from: OverlayPosition,
  ) => Promise<HistoryResult>;
}

export interface OverlayPresentation<F> {
  changed: () => void;
  rendered: () => Promise<void>;
  focus: (target: F | null, fallback?: string) => void;
  read?: () => void;
}

interface Request<F> {
  readonly from: F | null;
}

export interface LayerOptions<R, F = never> {
  history: (request: Readonly<R>) => boolean;
  modal: boolean | ((request: Readonly<R>) => boolean);
  fallback?: string;
  focusReturn?: () => F | null;
  parent?: string;
  // 请求不能比来源层活得更久（加入歌单的多选、换封面、播放队列）；可按请求给不同的来源层
  dependsOn?: string | ((request: Readonly<R>) => string | null);
  restore?: () => boolean;
  beforeClose?: () => boolean;
  dismissed?: () => void;
}

export interface OverlayLayer<R extends Request<F>, F> {
  readonly name: string;
  readonly request: Readonly<R> | null;
  readonly busy: boolean;
  readonly asSheet: boolean;
  readonly inert: boolean;
  readonly containerInert: boolean;
  setBusy: (busy: boolean) => void;
  open: (request: Readonly<R>) => Promise<OverlayResult>;
  transfer: <T extends Request<F>>(
    target: OverlayLayer<T, F>,
    request: Readonly<T>,
  ) => Promise<OverlayResult>;
  close: (restoreFocus?: boolean) => Promise<OverlayResult>;
  closeThrough: () => Promise<OverlayResult>;
  invalidate: () => Promise<OverlayResult>;
  leaveTo: (path: OverlayDestination) => Promise<OverlayResult>;
}

interface Registration<F> {
  name: string;
  options: LayerOptions<Request<F>, F>;
  active: Entry<F> | null;
  pendingId: number | null;
  sheet: boolean;
}

const dependencyOf = <F>(
  options: LayerOptions<Request<F>, F>,
  request: Request<F>,
): string | null =>
  typeof options.dependsOn === 'function'
    ? options.dependsOn(request)
    : (options.dependsOn ?? null);

interface Entry<F> {
  id: number;
  registration: Registration<F>;
  request: Request<F>;
  busy: boolean;
  modal: boolean;
  cursor: number | null;
  valid: boolean;
}

export const samePosition = (a: OverlayPosition, b: OverlayPosition): boolean =>
  a.cursor === b.cursor && a.url === b.url && a.stamp === b.stamp;

export class OverlayStack<F> {
  private readonly registrations = new WeakMap<object, Registration<F>>();
  private readonly remembered = new Map<number, Entry<F>>();
  private readonly slots = new Map<number, OverlayPosition>();
  private layers: Entry<F>[] = [];
  private nextId = 0;
  private pending: Promise<unknown> = Promise.resolve();
  private generation = 0;
  private position: OverlayPosition;
  private base: OverlayPosition;

  constructor(
    private readonly history: OverlayHistory,
    private readonly presentation: OverlayPresentation<F>,
    private readonly session: string,
  ) {
    this.position = this.base = history.read();
  }

  get top(): { readonly name: string } | null {
    this.presentation.read?.();
    const entry = this.layers.at(-1);
    return entry ? { name: entry.registration.name } : null;
  }

  get baseInert(): boolean {
    this.presentation.read?.();
    return this.layers.some((entry) => entry.modal);
  }

  get holdsHistory(): boolean {
    return this.layers.some((entry) => entry.cursor !== null);
  }

  register<R extends Request<F>>(
    name: string,
    options: LayerOptions<R, F>,
  ): OverlayLayer<R, F> {
    const registration: Registration<F> = {
      name,
      options: {
        ...options,
        history: (request) => options.history(request as Readonly<R>),
        modal:
          typeof options.modal === 'function'
            ? (request) =>
                (options.modal as (request: Readonly<R>) => boolean)(
                  request as Readonly<R>,
                )
            : options.modal,
        dependsOn:
          typeof options.dependsOn === 'function'
            ? (request) =>
                (options.dependsOn as (request: Readonly<R>) => string | null)(
                  request as Readonly<R>,
                )
            : options.dependsOn,
      },
      active: null,
      pendingId: null,
      sheet: false,
    };
    const read = () => {
      this.presentation.read?.();
      return registration.active;
    };
    const covered = (container: boolean) => {
      read();
      return this.covered(registration, container);
    };
    const layer: OverlayLayer<R, F> = {
      name,
      get request() {
        return (read()?.request ?? null) as Readonly<R> | null;
      },
      get busy() {
        return read()?.busy ?? false;
      },
      get asSheet() {
        read();
        return registration.sheet;
      },
      get inert() {
        return covered(false);
      },
      get containerInert() {
        return covered(true);
      },
      setBusy: (busy) => {
        if (registration.active) {
          registration.active.busy = busy;
          this.presentation.changed();
          if (!busy && !registration.active.valid)
            void this.invalidate(registration);
        }
      },
      open: (request) => this.open(registration, request),
      transfer: (target, request) =>
        this.open(this.registrations.get(target)!, request, registration),
      close: (focus = true) => this.close(registration, false, focus),
      closeThrough: () => this.close(registration, true, true),
      invalidate: () => this.invalidate(registration),
      leaveTo: (path) => this.leaveTo(registration, path),
    };
    this.registrations.set(layer, registration);
    return layer;
  }

  private covered(registration: Registration<F>, container: boolean): boolean {
    const index = this.layers.findIndex(
      (entry) => entry.registration === registration,
    );
    return this.layers
      .slice(index + 1)
      .some(
        (entry) =>
          entry.modal &&
          (!container ||
            entry.registration.options.parent !== registration.name),
      );
  }

  private permitted(entries: readonly Entry<F>[]): boolean {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]!;
      if (entry.busy || entry.registration.options.beforeClose?.() === false)
        return false;
    }
    return true;
  }

  navigate(): boolean {
    if (!this.permitted(this.layers)) return false;
    this.clear();
    return true;
  }

  clear(): void {
    this.generation += 1;
    this.remove(this.layers);
    this.position = this.base = this.history.read();
  }

  escape(): Promise<OverlayResult> {
    const entry = this.layers.at(-1);
    return entry
      ? this.close(entry.registration, false, true)
      : Promise.resolve('cancelled');
  }

  private run(
    action: (current: () => boolean) => Promise<OverlayResult>,
  ): Promise<OverlayResult> {
    const generation = this.generation;
    const current = () => generation === this.generation;
    const task = this.pending.then(() =>
      current() ? action(current) : ('invalidated' as const),
    );
    this.pending = task.catch(() => {});
    return task;
  }

  private marker(entries = this.layers): OverlayMarker | undefined {
    const ids = entries
      .filter((entry) => entry.cursor !== null)
      .map((entry) => entry.id);
    return ids.length ? { session: this.session, ids } : undefined;
  }

  private accept(result: HistoryResult, current: () => boolean): OverlayResult {
    if (!current() || result.status === 'invalidated') return 'invalidated';
    this.position = result.position;
    if (result.status === 'failed') throw result.error;
    return result.status;
  }

  private target(entries: readonly Entry<F>[]): OverlayPosition {
    const cursor = entries.findLast((entry) => entry.cursor !== null)?.cursor;
    return cursor === undefined || cursor === null
      ? this.base
      : this.slots.get(cursor)!;
  }

  private remove(removed: readonly Entry<F>[]): void {
    const leaving = new Set(removed);
    this.layers = this.layers.filter((entry) => !leaving.has(entry));
    for (const entry of removed) {
      entry.registration.active = null;
      if (!entry.valid || !entry.registration.options.restore)
        this.remembered.delete(entry.id);
      entry.registration.options.dismissed?.();
    }
    this.presentation.changed();
  }

  private async focus(entry: Entry<F>, current: () => boolean): Promise<void> {
    await this.presentation.rendered();
    if (!current()) return;
    const target =
      entry.registration.options.focusReturn?.() ?? entry.request.from;
    this.presentation.focus(target, entry.registration.options.fallback);
  }

  private open(
    registration: Registration<F>,
    request: Request<F>,
    source?: Registration<F>,
  ): Promise<OverlayResult> {
    const id = ++this.nextId;
    registration.pendingId = id;
    const sourceId = source?.active?.id ?? source?.pendingId;
    return this.run(async (current) => {
      const previous = source?.active;
      if (sourceId !== undefined && source?.active?.id !== sourceId)
        return 'invalidated';
      if (
        (source &&
          (!previous || previous !== this.layers.at(-1) || previous.busy)) ||
        registration.active
      )
        return 'cancelled';
      const dependsOn = dependencyOf(registration.options, request);
      if (
        dependsOn &&
        !this.layers.some(
          (entry) => entry.registration.name === dependsOn && entry.valid,
        )
      )
        return 'cancelled';
      const from = this.history.read();
      const historical = registration.options.history(request);
      if (!this.layers.some((entry) => entry.cursor !== null)) this.base = from;
      const entry: Entry<F> = {
        id,
        registration,
        request,
        busy: false,
        valid: true,
        modal:
          typeof registration.options.modal === 'function'
            ? registration.options.modal(request)
            : registration.options.modal,
        cursor: historical ? (previous?.cursor ?? from.cursor + 1) : null,
      };
      const next = this.layers
        .filter((item) => item !== previous)
        .concat(entry);
      let result: HistoryResult = { status: 'committed', position: from };
      if (historical)
        result = await this.history.write(
          this.marker(next),
          previous?.cursor !== null && previous?.cursor !== undefined,
          from,
        );
      else if (previous?.cursor !== null && previous?.cursor !== undefined)
        result = await this.history.go(this.target(next), from);
      const status = this.accept(result, current);
      if (status !== 'committed') return status;
      if (previous) {
        previous.valid = false;
        this.remove([previous]);
      }
      registration.active = entry;
      registration.sheet = historical;
      this.layers = next;
      this.remembered.set(entry.id, entry);
      if (historical) {
        entry.cursor = result.position.cursor;
        this.slots.set(entry.cursor, result.position);
      }
      this.presentation.changed();
      return 'committed';
    }).finally(() => {
      if (registration.pendingId === id) registration.pendingId = null;
    });
  }

  private close(
    registration: Registration<F>,
    through: boolean,
    restoreFocus: boolean,
  ): Promise<OverlayResult> {
    const expected = registration.active?.id ?? registration.pendingId;
    return this.run(async (current) => {
      if (expected === null) return 'cancelled';
      if (registration.active?.id !== expected) return 'invalidated';
      const index = this.layers.findIndex(
        (entry) => entry.registration === registration,
      );
      if (index < 0 || (!through && index !== this.layers.length - 1))
        return 'cancelled';
      const removed = this.layers.slice(index);
      if (!this.permitted(removed)) return 'cancelled';
      if (removed.some((entry) => entry.cursor !== null)) {
        const status = this.accept(
          await this.history.go(
            this.target(this.layers.slice(0, index)),
            this.history.read(),
          ),
          current,
        );
        if (status !== 'committed') return status;
      }
      this.remove(removed);
      if (restoreFocus) await this.focus(removed[0]!, current);
      return current() ? 'committed' : 'invalidated';
    });
  }

  private invalidate(registration: Registration<F>): Promise<OverlayResult> {
    const expected = registration.active?.id ?? registration.pendingId;
    return this.run(async (current) => {
      if (expected === null) return 'cancelled';
      if (registration.active?.id !== expected) return 'invalidated';
      const names = new Set([registration.name]);
      const removed: Entry<F>[] = [];
      for (const entry of this.layers) {
        if (
          !names.has(entry.registration.name) &&
          !names.has(
            dependencyOf(entry.registration.options, entry.request) ?? '',
          )
        )
          continue;
        names.add(entry.registration.name);
        entry.valid = false;
        if (this.permitted([entry])) removed.push(entry);
      }
      for (const entry of this.remembered.values()) {
        if (names.has(entry.registration.name)) entry.valid = false;
      }
      if (!removed.length) return 'cancelled';
      const next = this.layers.filter((entry) => !removed.includes(entry));
      const from = this.history.read();
      let result: HistoryResult = { status: 'committed', position: from };
      if (removed.some((entry) => entry.cursor !== null)) {
        const target = this.target(next);
        result =
          target.cursor < from.cursor
            ? await this.history.go(target, from)
            : await this.history.write(this.marker(next), true, from);
      }
      const status = this.accept(result, current);
      if (status !== 'committed') return status;
      if (next.some((entry) => entry.cursor === result.position.cursor))
        this.slots.set(result.position.cursor, result.position);
      const top = this.layers.at(-1)!;
      this.remove(removed);
      if (removed.includes(top)) await this.focus(top, current);
      return current() ? 'committed' : 'invalidated';
    });
  }

  private leaveTo(
    registration: Registration<F>,
    path: OverlayDestination,
  ): Promise<OverlayResult> {
    const expected = registration.active?.id ?? registration.pendingId;
    return this.run(async (current) => {
      if (expected === null) return 'cancelled';
      if (registration.active?.id !== expected) return 'invalidated';
      return this.depart(path, true, current);
    });
  }

  leave(path: OverlayDestination): Promise<OverlayResult> {
    return this.run((current) => this.depart(path, false, current));
  }

  private async depart(
    path: OverlayDestination,
    replace: boolean,
    current: () => boolean,
  ): Promise<OverlayResult> {
    if (!this.permitted(this.layers)) return 'cancelled';
    const origin = this.history.read();
    const hadHistory = this.holdsHistory;
    if (hadHistory) {
      const status = this.accept(
        await this.history.go(this.base, origin),
        current,
      );
      if (status !== 'committed') return status;
    }
    const result = await this.history.leave(path, replace, this.history.read());
    if (!current() || result.status === 'invalidated') return 'invalidated';
    if (result.status === 'committed') {
      this.settle(result.position);
      return 'committed';
    }
    if (hadHistory) {
      const restored = this.accept(
        await this.history.go(origin, result.position),
        current,
      );
      if (restored === 'cancelled') this.settle(this.history.read());
      else if (restored !== 'committed') return 'invalidated';
    }
    if (result.status === 'failed') throw result.error;
    return result.status;
  }

  private settle(position: OverlayPosition): void {
    this.position = position;
    this.remove(this.layers);
    this.remembered.clear();
    this.slots.clear();
    this.base = position;
  }

  reconcile(phase: 'intent' | 'settled' = 'settled'): Promise<OverlayResult> {
    this.generation += 1;
    if (phase === 'intent') return Promise.resolve('invalidated');
    return this.run(async (current) => {
      const position = this.history.read();
      if (position.url !== this.position.url) {
        this.clear();
        return 'invalidated';
      }
      const ids =
        position.marker?.session === this.session ? position.marker.ids : [];
      const next: Entry<F>[] = [];
      for (const id of ids) {
        const entry = this.remembered.get(id);
        if (!entry?.valid) continue;
        const active = this.layers.includes(entry);
        if (!active && !entry.registration.options.restore?.()) continue;
        const dependsOn = dependencyOf(
          entry.registration.options,
          entry.request,
        );
        if (
          dependsOn &&
          !next.some((parent) => parent.registration.name === dependsOn)
        )
          continue;
        next.push(entry);
      }
      const removed = this.layers.filter(
        (entry) => entry.cursor !== null && !next.includes(entry),
      );
      if (removed.length) {
        const first = this.layers.indexOf(removed[0]!);
        for (const entry of this.layers.slice(first)) {
          if (!removed.includes(entry) && entry.cursor === null)
            removed.push(entry);
        }
        if (!this.permitted(removed))
          return this.accept(
            await this.history.go(this.position, position),
            current,
          );
      }
      const remainingLocal = this.layers.filter(
        (entry) => entry.cursor === null && !removed.includes(entry),
      );
      const live = next.concat(remainingLocal);
      const backwards = position.cursor < this.position.cursor;
      if (
        backwards &&
        !next.length &&
        position.cursor > this.base.cursor &&
        position.marker?.session === this.session
      ) {
        const status = this.accept(
          await this.history.go(this.base, position),
          current,
        );
        if (status !== 'committed') return status;
      } else {
        this.position = position;
        if (
          position.marker &&
          (position.marker.session !== this.session ||
            ids.length !== next.length)
        ) {
          const status = this.accept(
            await this.history.write(this.marker(live), true, position),
            current,
          );
          if (status !== 'committed') return status;
        }
      }
      this.remove(removed);
      this.layers = live;
      for (const entry of next) entry.registration.active = entry;
      // 槽位按真实条目重记（关它时 target() 才找得到），用 this.position：刚写过 replace 时局部 position 是写之前的
      if (next.some((entry) => entry.cursor === position.cursor))
        this.slots.set(position.cursor, this.position);
      this.presentation.changed();
      if (removed.length) await this.focus(removed[0]!, current);
      return current() ? 'committed' : 'invalidated';
    });
  }
}
