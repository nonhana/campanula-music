import type { HistoryResult, OverlayDestination, OverlayHistory, OverlayMarker, OverlayPosition, OverlayResult } from '../../src/lib/components/overlay/overlay-stack'
import { samePosition } from '../../src/lib/components/overlay/overlay-stack'

type Kind = 'write' | 'go' | 'leave' | 'traverse'
type Phase = 'beforeCommit' | 'afterCommit'

/**
 * 浏览器的 History push/replace 会在 Kit 等 onNavigate 之前就改掉物理条目
 * （Kit 3.1 client.js:2122–2150、2938–2954），page.state 要更晚才发布。取消时 goto 会 resolve
 * 却没有提交（:1971–1975、2900–2904）；navigation.complete 在被顶替时 reject（:2264–2266）。
 * 这个端口把这两种情况分开报，而不是回到 goto 的 void。越界的原生遍历不会发事件；
 * 端口对未知目标直接返回 cancelled、不发起遍历，所以两个适配器都不会去等一个等不到的 page.state 变化。
 */
export class MemoryOverlayHistory implements OverlayHistory {
  private entries: OverlayPosition[]
  index = 0
  private rendered: OverlayPosition
  private revision = 0
  private stamp = 0
  private changed: (phase?: 'intent' | 'settled') => Promise<OverlayResult> = async () => 'committed'
  private navigating: () => boolean = () => true
  private hold: { kind: Kind, phase: Phase, reached: () => void, waiting: Promise<void> } | null = null
  private failure: { kind: Kind, phase: Phase, error: Error } | null = null
  private cancelled: Kind | null = null

  constructor(url: string) {
    this.rendered = { cursor: 0, url }
    this.entries = [this.rendered]
  }

  get length(): number { return this.entries.length }
  get url(): string { return this.entries[this.index]!.url }
  read = (): OverlayPosition => structuredClone(this.rendered)

  listen(changed: (phase?: 'intent' | 'settled') => Promise<OverlayResult>, navigating: () => boolean = () => true): void {
    this.changed = changed
    this.navigating = navigating
  }

  holdNext(kind: Kind, phase: Phase): { reached: Promise<void>, release: () => void } {
    let reached!: () => void
    let release!: () => void
    const arrived = new Promise<void>((resolve) => {
      reached = resolve
    })
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    this.hold = { kind, phase, reached, waiting }
    return { reached: arrived, release }
  }

  failNext(kind: Kind, phase: Phase): void {
    this.failure = { kind, phase, error: new Error(`${kind} failed ${phase}`) }
  }

  cancelNext(kind: Kind): void { this.cancelled = kind }

  private async phase(kind: Kind, phase: Phase): Promise<void> {
    if (this.hold?.kind === kind && this.hold.phase === phase) {
      const hold = this.hold
      this.hold = null
      hold.reached()
      await hold.waiting
    }
    if (this.failure?.kind === kind && this.failure.phase === phase) {
      const error = this.failure.error
      this.failure = null
      throw error
    }
  }

  private result(status: OverlayResult): HistoryResult { return { status, position: this.read() } }

  private async change(kind: Kind, from: OverlayPosition, commit: () => void, undo: () => void): Promise<HistoryResult> {
    if (!samePosition(from, this.read()) || !samePosition(this.entries[this.index]!, from))
      return this.result('invalidated')
    const mine = ++this.revision
    let written: OverlayPosition | null = null
    try {
      await this.phase(kind, 'beforeCommit')
      if (mine !== this.revision)
        return this.result('invalidated')
      if (this.cancelled === kind) {
        this.cancelled = null
        return this.result('cancelled')
      }
      commit()
      written = this.entries[this.index]!
      await this.phase(kind, 'afterCommit')
      if (mine !== this.revision)
        return this.result('invalidated')
      this.rendered = this.entries[this.index]!
      return this.result('committed')
    }
    catch (error) {
      if (mine !== this.revision || (written && this.entries[this.index] !== written))
        return this.result('invalidated')
      if (written)
        undo()
      this.rendered = this.entries[this.index]!
      return { status: 'failed', error, position: this.read() }
    }
  }

  write = (marker: OverlayMarker | undefined, replace: boolean, from: OverlayPosition): Promise<HistoryResult> => {
    const previous = this.entries[this.index]!
    return this.change('write', from, () => {
      const stamp = `memory-${++this.stamp}`
      const entry = { cursor: from.cursor + (replace ? 0 : 1), url: from.url, stamp, marker: marker ? { ...structuredClone(marker), stamp } : undefined }
      if (replace) {
        this.entries[this.index] = entry
      }
      else {
        this.entries.splice(this.index + 1, Infinity, entry)
        this.index += 1
      }
    }, () => {
      if (replace)
        this.entries[this.index] = previous
      else
        this.index -= 1
    })
  }

  go = (target: OverlayPosition, from: OverlayPosition): Promise<HistoryResult> => {
    const index = this.entries.findIndex(entry => samePosition(entry, target))
    if (index < 0)
      return Promise.resolve(this.result('cancelled'))
    const previous = this.index
    return this.change('go', from, () => {
      this.index = index
    }, () => {
      this.index = previous
    })
  }

  leave = (path: OverlayDestination, from: OverlayPosition): Promise<HistoryResult> => {
    const previous = this.entries[this.index]!
    return this.change('leave', from, () => {
      this.entries[this.index] = { cursor: from.cursor, url: path }
    }, () => { this.entries[this.index] = previous })
  }

  /** 真的浏览器后退/前进，不是核心发起的端口命令。 */
  async traverse(delta: number): Promise<void> {
    const target = this.index + delta
    if (target < 0 || target >= this.entries.length)
      return // 浏览器什么也不做，也不发事件。
    const mine = ++this.revision
    this.index = target
    void this.changed('intent')
    await this.phase('traverse', 'afterCommit')
    if (mine !== this.revision)
      return
    this.rendered = this.entries[this.index]!
    await this.changed()
  }

  back = (): Promise<void> => this.traverse(-1)
  forward = (): Promise<void> => this.traverse(1)

  async navigate(url: string): Promise<void> {
    if (!this.navigating())
      return
    this.revision += 1
    const entry = { cursor: this.entries[this.index]!.cursor + 1, url }
    this.entries.splice(this.index + 1, Infinity, entry)
    this.index += 1
    this.rendered = entry
    await this.changed()
  }

  reload(): void {
    this.revision += 1
    this.entries[this.index] = { cursor: this.entries[this.index]!.cursor, url: this.url }
    this.rendered = this.entries[this.index]!
    this.changed = async () => 'committed'
    this.navigating = () => true
  }
}
