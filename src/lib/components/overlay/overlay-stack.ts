/** 请求和焦点从不进历史。stamp 标记的是一条已提交的历史条目，不是某个层。 */
export interface OverlayMarker {
  readonly session: string
  readonly ids: readonly number[]
  readonly stamp?: string
}

export interface OverlayPosition {
  readonly cursor: number
  readonly url: string
  readonly marker?: OverlayMarker
  readonly stamp?: string
}

export type OverlayDestination = '/' | '/playlists'
export type OverlayResult = 'committed' | 'cancelled' | 'invalidated'
export type HistoryResult
  = | { readonly status: OverlayResult, readonly position: OverlayPosition }
    | { readonly status: 'failed', readonly position: OverlayPosition, readonly error: unknown }

/** 每个操作先核对起点、再确认确切的目标条目。失败后的恢复由适配器负责。 */
export interface OverlayHistory {
  read: () => OverlayPosition
  write: (marker: OverlayMarker | undefined, replace: boolean, from: OverlayPosition) => Promise<HistoryResult>
  go: (target: OverlayPosition, from: OverlayPosition) => Promise<HistoryResult>
  leave: (path: OverlayDestination, from: OverlayPosition) => Promise<HistoryResult>
}

export interface OverlayPresentation<F> {
  changed: () => void
  rendered: () => Promise<void>
  focus: (target: F | null, fallback?: string) => void
  read?: () => void
}

interface Request<F> { readonly from: F | null }

export interface LayerOptions<R, F = never> {
  history: (request: Readonly<R>) => boolean
  modal: boolean | ((request: Readonly<R>) => boolean)
  fallback?: string
  /**
   * 关掉后焦点交给谁：打开这一层的按钮在层开着时会被换掉时用（多选）。
   * 只在焦点归还（close / invalidate，以及它们经由 reconcile 的返回路径）里、rendered 之后调用；
   * 返回 null 时回退 request.from（适配器只接受仍 connected 的），再回退 fallback（层内元素 / main）。
   * 不传时和以前完全一样。
   */
  focusReturn?: () => F | null
  /** 只表示 DOM 包含关系，不表示业务归属。 */
  parent?: string
  /**
   * 这条请求不能比来源层活得更久（加入歌单的多选、换封面、播放队列）。
   * 可以按请求给不同的来源层：同一个选择器，多选的请求依赖多选层，单曲的不依赖（#73）
   */
  dependsOn?: string | ((request: Readonly<R>) => string | null)
  /** 只有播放类的层才登记同一会话内的前进恢复。 */
  restore?: () => boolean
  beforeClose?: () => boolean
  dismissed?: () => void
}

export interface OverlayLayer<R extends Request<F>, F> {
  readonly name: string
  readonly request: Readonly<R> | null
  readonly busy: boolean
  readonly asSheet: boolean
  readonly inert: boolean
  readonly containerInert: boolean
  setBusy: (busy: boolean) => void
  open: (request: Readonly<R>) => Promise<OverlayResult>
  transfer: <T extends Request<F>>(target: OverlayLayer<T, F>, request: Readonly<T>) => Promise<OverlayResult>
  close: (restoreFocus?: boolean) => Promise<OverlayResult>
  closeThrough: () => Promise<OverlayResult>
  invalidate: () => Promise<OverlayResult>
  leaveTo: (path: OverlayDestination) => Promise<OverlayResult>
}

interface Registration<F> {
  name: string
  options: LayerOptions<Request<F>, F>
  active: Entry<F> | null
  pendingId: number | null
  sheet: boolean
}

/** 这一条请求依赖哪个来源层；不依赖是 null */
const dependencyOf = <F>(options: LayerOptions<Request<F>, F>, request: Request<F>): string | null => typeof options.dependsOn === 'function'
  ? options.dependsOn(request)
  : options.dependsOn ?? null

interface Entry<F> {
  id: number
  registration: Registration<F>
  request: Request<F>
  busy: boolean
  modal: boolean
  cursor: number | null
  valid: boolean
}

export const samePosition = (a: OverlayPosition, b: OverlayPosition): boolean => a.cursor === b.cursor && a.url === b.url && a.stamp === b.stamp

/** 不依赖 DOM/Kit。看得见的层与它占住的历史条目是有意分开的两件事。 */
export class OverlayStack<F> {
  private readonly registrations = new WeakMap<object, Registration<F>>()
  private readonly remembered = new Map<number, Entry<F>>()
  private readonly slots = new Map<number, OverlayPosition>()
  private layers: Entry<F>[] = []
  private nextId = 0
  private pending: Promise<unknown> = Promise.resolve()
  private generation = 0
  private position: OverlayPosition
  private base: OverlayPosition

  constructor(private readonly history: OverlayHistory, private readonly presentation: OverlayPresentation<F>, private readonly session: string) {
    this.position = this.base = history.read()
  }

  get top(): { readonly name: string } | null {
    this.presentation.read?.()
    const entry = this.layers.at(-1)
    return entry
      ? { name: entry.registration.name }
      : null
  }

  get baseInert(): boolean {
    this.presentation.read?.()
    return this.layers.some(entry => entry.modal)
  }

  register<R extends Request<F>>(name: string, options: LayerOptions<R, F>): OverlayLayer<R, F> {
    const registration: Registration<F> = {
      name,
      options: {
        ...options,
        history: request => options.history(request as Readonly<R>),
        modal: typeof options.modal === 'function'
          ? request => (options.modal as (request: Readonly<R>) => boolean)(request as Readonly<R>)
          : options.modal,
        dependsOn: typeof options.dependsOn === 'function'
          ? request => (options.dependsOn as (request: Readonly<R>) => string | null)(request as Readonly<R>)
          : options.dependsOn,
      },
      active: null,
      pendingId: null,
      sheet: false,
    }
    const read = () => {
      this.presentation.read?.()
      return registration.active
    }
    const covered = (container: boolean) => {
      read()
      return this.covered(registration, container)
    }
    const layer: OverlayLayer<R, F> = {
      name,
      get request() { return (read()?.request ?? null) as Readonly<R> | null },
      get busy() { return read()?.busy ?? false },
      get asSheet() {
        read()
        return registration.sheet
      },
      get inert() { return covered(false) },
      get containerInert() { return covered(true) },
      setBusy: (busy) => {
        if (registration.active) {
          registration.active.busy = busy
          this.presentation.changed()
          if (!busy && !registration.active.valid)
            void this.invalidate(registration)
        }
      },
      open: request => this.open(registration, request),
      transfer: (target, request) => this.open(this.registrations.get(target)!, request, registration),
      close: (focus = true) => this.close(registration, false, focus),
      closeThrough: () => this.close(registration, true, true),
      invalidate: () => this.invalidate(registration),
      leaveTo: path => this.leaveTo(registration, path),
    }
    this.registrations.set(layer, registration)
    return layer
  }

  private covered(registration: Registration<F>, container: boolean): boolean {
    // 这一层自己不在栈里（例如播放页没开）时 findIndex 给 -1，slice(0) 把栈里所有 modal 层都算进去：
    // 对 container 来说这正是想要的——外框里的提示条（PlayerLayer 的 layer.containerInert）在弹窗盖上来时该 inert，
    // 和基线 inert={dialogOpen} 一致。对层元素自己（container=false）多算的 true 也无害：
    // 没打开时组件本来就用 !request 把整块标成 inert。
    const index = this.layers.findIndex(entry => entry.registration === registration)
    return this.layers.slice(index + 1).some(entry => entry.modal && (!container || entry.registration.options.parent !== registration.name))
  }

  private permitted(entries: readonly Entry<F>[]): boolean {
    // 一次关闭意图里，每个有副作用的守卫只从上往下求值一次。
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]!
      if (entry.busy || entry.registration.options.beforeClose?.() === false)
        return false
    }
    return true
  }

  /** 外部路由意图，包括自己还有操作在排队时到达的那些。 */
  navigate(): boolean {
    if (!this.permitted(this.layers))
      return false
    this.clear()
    return true
  }

  /**
   * 换页、外部导航只撤掉看得见的层：可恢复的记忆（remembered）和它占过的槽位（slots）留着，
   * 同一会话再走回这些历史条目时，reconcile 按标记把层重建出来（F1 的跨页前进）。
   * 只有落到与本条同 URL 的条目才会重建：从别的 URL 落到带标记的条目时，这一趟只 clear 并返回，
   * 要等同 URL 的下一次遍历（reconcile 的 URL 门槛）。
   * 刷新、新会话由新的栈实例和条目上的会话标识挡掉；leaveTo 是真的离开，那时另外清空。
   */
  clear(): void {
    this.generation += 1
    this.remove(this.layers)
    this.position = this.base = this.history.read()
  }

  escape(): Promise<OverlayResult> {
    const entry = this.layers.at(-1)
    return entry
      ? this.close(entry.registration, false, true)
      : Promise.resolve('cancelled')
  }

  private run(action: (current: () => boolean) => Promise<OverlayResult>): Promise<OverlayResult> {
    const generation = this.generation
    const current = () => generation === this.generation
    const task = this.pending.then(() => current()
      ? action(current)
      : 'invalidated' as const)
    this.pending = task.catch(() => {})
    return task
  }

  private marker(entries = this.layers): OverlayMarker | undefined {
    const ids = entries.filter(entry => entry.cursor !== null).map(entry => entry.id)
    return ids.length
      ? { session: this.session, ids }
      : undefined
  }

  private accept(result: HistoryResult, current: () => boolean): OverlayResult {
    if (!current() || result.status === 'invalidated')
      return 'invalidated'
    this.position = result.position
    if (result.status === 'failed')
      throw result.error
    return result.status
  }

  private target(entries: readonly Entry<F>[]): OverlayPosition {
    const cursor = entries.findLast(entry => entry.cursor !== null)?.cursor
    return cursor === undefined || cursor === null
      ? this.base
      : this.slots.get(cursor)!
  }

  private remove(removed: readonly Entry<F>[]): void {
    const leaving = new Set(removed)
    this.layers = this.layers.filter(entry => !leaving.has(entry))
    for (const entry of removed) {
      entry.registration.active = null
      if (!entry.valid || !entry.registration.options.restore)
        this.remembered.delete(entry.id)
      entry.registration.options.dismissed?.()
    }
    this.presentation.changed()
  }

  /** 焦点归还的唯一路径（close / invalidate，以及 reconcile 关掉层之后）：等 DOM 更新完再问 */
  private async focus(entry: Entry<F>, current: () => boolean): Promise<void> {
    await this.presentation.rendered()
    if (!current())
      return
    // 入口被层换掉时（多选）由登记方重新找；没有或返回 null 时回到 request.from。
    // 适配器只接受仍 connected、不在 inert 里的元素，再兜底到 fallback（层内元素 / main）。
    const target = entry.registration.options.focusReturn?.() ?? entry.request.from
    this.presentation.focus(target, entry.registration.options.fallback)
  }

  private open(registration: Registration<F>, request: Request<F>, source?: Registration<F>): Promise<OverlayResult> {
    const id = ++this.nextId
    registration.pendingId = id
    const sourceId = source?.active?.id ?? source?.pendingId
    return this.run(async (current) => {
      const previous = source?.active
      if (sourceId !== undefined && source?.active?.id !== sourceId)
        return 'invalidated'
      if ((source && (!previous || previous !== this.layers.at(-1) || previous.busy)) || registration.active)
        return 'cancelled'
      const dependsOn = dependencyOf(registration.options, request)
      if (dependsOn && !this.layers.some(entry => entry.registration.name === dependsOn && entry.valid))
        return 'cancelled'
      const from = this.history.read()
      const historical = registration.options.history(request)
      if (!this.layers.some(entry => entry.cursor !== null))
        this.base = from
      const entry: Entry<F> = {
        id,
        registration,
        request,
        busy: false,
        valid: true,
        modal: typeof registration.options.modal === 'function'
          ? registration.options.modal(request)
          : registration.options.modal,
        cursor: historical
          ? (previous?.cursor ?? from.cursor + 1)
          : null,
      }
      const next = this.layers.filter(item => item !== previous).concat(entry)
      let result: HistoryResult = { status: 'committed', position: from }
      if (historical)
        result = await this.history.write(this.marker(next), previous?.cursor !== null && previous?.cursor !== undefined, from)
      else if (previous?.cursor !== null && previous?.cursor !== undefined)
        result = await this.history.go(this.target(next), from)
      const status = this.accept(result, current)
      if (status !== 'committed')
        return status
      if (previous) {
        previous.valid = false
        this.remove([previous])
      }
      registration.active = entry
      registration.sheet = historical
      this.layers = next
      this.remembered.set(entry.id, entry)
      if (historical) {
        entry.cursor = result.position.cursor
        this.slots.set(entry.cursor, result.position)
      }
      this.presentation.changed()
      return 'committed'
    }).finally(() => {
      if (registration.pendingId === id)
        registration.pendingId = null
    })
  }

  private close(registration: Registration<F>, through: boolean, restoreFocus: boolean): Promise<OverlayResult> {
    const expected = registration.active?.id ?? registration.pendingId
    return this.run(async (current) => {
      if (expected === null)
        return 'cancelled'
      if (registration.active?.id !== expected)
        return 'invalidated'
      const index = this.layers.findIndex(entry => entry.registration === registration)
      if (index < 0 || (!through && index !== this.layers.length - 1))
        return 'cancelled'
      const removed = this.layers.slice(index)
      if (!this.permitted(removed))
        return 'cancelled'
      if (removed.some(entry => entry.cursor !== null)) {
        const status = this.accept(await this.history.go(this.target(this.layers.slice(0, index)), this.history.read()), current)
        if (status !== 'committed')
          return status
      }
      this.remove(removed)
      if (restoreFocus)
        await this.focus(removed[0]!, current)
      return current()
        ? 'committed'
        : 'invalidated'
    })
  }

  private invalidate(registration: Registration<F>): Promise<OverlayResult> {
    const expected = registration.active?.id ?? registration.pendingId
    return this.run(async (current) => {
      if (expected === null)
        return 'cancelled'
      if (registration.active?.id !== expected)
        return 'invalidated'
      const names = new Set([registration.name])
      const removed: Entry<F>[] = []
      for (const entry of this.layers) {
        if (!names.has(entry.registration.name) && !names.has(dependencyOf(entry.registration.options, entry.request) ?? ''))
          continue
        names.add(entry.registration.name)
        entry.valid = false
        if (this.permitted([entry]))
          removed.push(entry)
      }
      for (const entry of this.remembered.values()) {
        if (names.has(entry.registration.name))
          entry.valid = false
      }
      if (!removed.length)
        return 'cancelled'
      const next = this.layers.filter(entry => !removed.includes(entry))
      const from = this.history.read()
      let result: HistoryResult = { status: 'committed', position: from }
      if (removed.some(entry => entry.cursor !== null)) {
        const target = this.target(next)
        result = target.cursor < from.cursor
          ? await this.history.go(target, from)
          : await this.history.write(this.marker(next), true, from)
      }
      const status = this.accept(result, current)
      if (status !== 'committed')
        return status
      if (next.some(entry => entry.cursor === result.position.cursor))
        this.slots.set(result.position.cursor, result.position)
      const top = this.layers.at(-1)!
      this.remove(removed)
      if (removed.includes(top))
        await this.focus(top, current)
      return current()
        ? 'committed'
        : 'invalidated'
    })
  }

  private leaveTo(registration: Registration<F>, path: OverlayDestination): Promise<OverlayResult> {
    const expected = registration.active?.id ?? registration.pendingId
    return this.run(async (current) => {
      if (expected === null)
        return 'cancelled'
      if (registration.active?.id !== expected)
        return 'invalidated'
      if (!this.permitted(this.layers))
        return 'cancelled'
      const origin = this.history.read()
      const hadHistory = this.layers.some(entry => entry.cursor !== null)
      if (hadHistory) {
        const status = this.accept(await this.history.go(this.base, origin), current)
        if (status !== 'committed')
          return status
      }
      const result = await this.history.leave(path, this.history.read())
      if (!current() || result.status === 'invalidated')
        return 'invalidated'
      // 只恢复仍然归自己所有的那条来源条目，绝不按前进差值盲退。
      if (result.status !== 'committed') {
        if (hadHistory) {
          const restored = await this.history.go(origin, result.position)
          if (this.accept(restored, current) !== 'committed')
            return 'invalidated'
        }
        if (result.status === 'failed')
          throw result.error
        return result.status
      }
      this.position = result.position
      this.remove(this.layers)
      this.remembered.clear()
      this.slots.clear()
      this.base = result.position
      return 'committed'
    })
  }

  /** 外部观察会立刻让排队中的命令失效，再按真实的最新条目对账。 */
  reconcile(phase: 'intent' | 'settled' = 'settled'): Promise<OverlayResult> {
    this.generation += 1
    if (phase === 'intent')
      return Promise.resolve('invalidated')
    return this.run(async (current) => {
      const position = this.history.read()
      if (position.url !== this.position.url) {
        this.clear()
        return 'invalidated'
      }
      const ids = position.marker?.session === this.session
        ? position.marker.ids
        : []
      const next: Entry<F>[] = []
      for (const id of ids) {
        const entry = this.remembered.get(id)
        if (!entry?.valid)
          continue
        const active = this.layers.includes(entry)
        if (!active && !entry.registration.options.restore?.())
          continue
        const dependsOn = dependencyOf(entry.registration.options, entry.request)
        if (dependsOn && !next.some(parent => parent.registration.name === dependsOn))
          continue
        next.push(entry)
      }
      // 普通的浅路由变化时，不占历史的层仍留在各自有历史的父层上面。
      const removed = this.layers.filter(entry => entry.cursor !== null && !next.includes(entry))
      if (removed.length) {
        const first = this.layers.indexOf(removed[0]!)
        for (const entry of this.layers.slice(first)) {
          if (!removed.includes(entry) && entry.cursor === null)
            removed.push(entry)
        }
        if (!this.permitted(removed))
          return this.accept(await this.history.go(this.position, position), current)
      }
      const remainingLocal = this.layers.filter(entry => entry.cursor === null && !removed.includes(entry))
      const live = next.concat(remainingLocal)
      const backwards = position.cursor < this.position.cursor
      if (backwards && !next.length && position.cursor > this.base.cursor && position.marker?.session === this.session) {
        const status = this.accept(await this.history.go(this.base, position), current)
        if (status !== 'committed')
          return status
      }
      else {
        this.position = position
        if (position.marker && (position.marker.session !== this.session || ids.length !== next.length)) {
          const status = this.accept(await this.history.write(this.marker(live), true, position), current)
          if (status !== 'committed')
            return status
        }
      }
      this.remove(removed)
      this.layers = live
      for (const entry of next)
        entry.registration.active = entry
      // 恢复出来的层占的就是当前这条历史：槽位按真实条目重记一次，关它时 target() 才找得到。
      // 用 this.position：上面若刚写过 replace，accept 已把它换成新 stamp 的那条，局部的 position 是写之前的。
      if (next.some(entry => entry.cursor === position.cursor))
        this.slots.set(position.cursor, this.position)
      this.presentation.changed()
      if (removed.length)
        await this.focus(removed[0]!, current)
      return current()
        ? 'committed'
        : 'invalidated'
    })
  }
}
