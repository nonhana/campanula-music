// PROTOTYPE：交互原型的全部状态（只在内存里）。
// 写操作照 ADR-0007：先改本地、立即生效，再提交给（假的）网易云，失败就回滚。
// 排序一次提交整张歌单的全部编号，所以连续拖动会合并：最后一次拖完后等 settings.mergeDelay 再提交。
import type { DownloadState, Playlist, Song } from './data'
import { page } from '$app/state'
import { netease } from './api.svelte'
import { BIG_ID, playlists as basePlaylists, initialTracks } from './data'
import { settings } from './settings.svelte'

export type Variant = 'A' | 'B' | 'C'
export type Engine = 'pointer' | 'action' | 'kit'
export type Screen = 'playlist' | 'library'

export const variantNames: Record<Variant, string> = { A: '长按拖动', B: '拖动把手', C: '编辑模式' }
export const coverVariantNames: Record<Variant, string> = { A: '单独的裁剪页', B: '自动居中，可再调整', C: '弹层里原地裁剪' }
export const engineNames: Record<Engine, string> = { pointer: '自写', action: 'svelte-dnd-action', kit: 'dnd-kit' }

/** 界面状态都在网址参数里（可分享、刷新不丢）：variant、engine、screen、pl、shot */
export const view = {
  get route(): 'dnd' | 'cover' {
    return page.url.pathname.includes('/cover') ? 'cover' : 'dnd'
  },
  /** 网址里的 ?variant=，原样（切换栏显示用） */
  get variant(): Variant {
    const v = page.url.searchParams.get('variant')
    return v === 'B' || v === 'C' ? v : 'A'
  },
  /** 拖动方案：只在拖动页跟着 ?variant= 变；封面页里列表固定用方案 A */
  get dragVariant(): Variant {
    return this.route === 'dnd' ? this.variant : 'A'
  },
  /** 封面流程：只在封面页跟着 ?variant= 变 */
  get coverVariant(): Variant {
    return this.route === 'cover' ? this.variant : 'A'
  },
  get engine(): Engine {
    const e = page.url.searchParams.get('engine')
    return e === 'action' || e === 'kit' ? e : 'pointer'
  },
  get screen(): Screen {
    return page.url.searchParams.get('screen') === 'library' ? 'library' : 'playlist'
  },
  /** 拖动页默认是 4,815 首的「ACG 大合集」；封面页默认是 7 首的「一起看海」，列表短，方便看封面 */
  get pl(): string {
    return page.url.searchParams.get('pl') ?? (this.route === 'cover' ? 'pl-umi' : BIG_ID)
  },
  /** 截图模式：不显示原型切换栏 */
  get shot(): boolean {
    return page.url.searchParams.get('shot') === '1'
  },
}

// ───────────── 提示条 ─────────────

export interface Toast {
  id: number
  text: string
  tone?: 'error'
  action?: { label: string, run: () => void }
}

/** height：提示条那一摞现在有多高（Toasts 量出来，原型切换栏据此往上让） */
export const toasts = $state({ list: [] as Toast[], height: 0 })
let toastSeq = 0

export function toast(text: string, opts: { tone?: 'error', action?: Toast['action'], duration?: number } = {}): number {
  const id = ++toastSeq
  toasts.list = [...toasts.list.slice(-2), { id, text, tone: opts.tone, action: opts.action }]
  setTimeout(() => dismissToast(id), opts.duration ?? (opts.action ? 6000 : 3200))
  return id
}

export function dismissToast(id: number) {
  toasts.list = toasts.list.filter(t => t.id !== id)
}

// ───────────── 合并提交 ─────────────

type CommitStatus = 'idle' | 'waiting' | 'saving' | 'failed'

const commits = new Set<Commit>()

/** 离开歌单、切到后台、关页面之前：把还在等待合并的顺序立刻提交，不等计时器 */
export function flushPending() {
  for (const c of commits) {
    if (c.status === 'waiting')
      void c.flush()
  }
}

class Commit {
  status = $state<CommitStatus>('idle')
  dueAt = $state(0)
  /** 一共真的提交了几次（用来证明连续拖动被合并） */
  sent = $state(0)
  /** 一共改了几次（每拖一次 +1） */
  touched = $state(0)
  #timer: ReturnType<typeof setTimeout> | undefined
  #inflight = false
  #again = false
  readonly #run: () => Promise<void>

  constructor(run: () => Promise<void>) {
    this.#run = run
    commits.add(this)
  }

  touch() {
    this.touched++
    if (this.#inflight) {
      this.#again = true
      return
    }
    this.status = 'waiting'
    clearTimeout(this.#timer)
    this.dueAt = Date.now() + settings.mergeDelay
    this.#timer = setTimeout(() => this.flush(), settings.mergeDelay)
  }

  async flush() {
    clearTimeout(this.#timer)
    this.#timer = undefined
    if (this.#inflight) {
      this.#again = true
      return
    }
    this.#inflight = true
    this.status = 'saving'
    this.sent++
    try {
      await this.#run()
      this.status = 'idle'
    }
    catch {
      this.status = 'failed'
      this.#again = false
    }
    finally {
      this.#inflight = false
      if (this.#again) {
        this.#again = false
        this.touch()
      }
    }
  }
}

// ───────────── 歌单曲目 ─────────────

export class Tracks {
  local = $state.raw<Song[]>([])
  confirmed: Song[]
  #failed: Song[] | null = null
  readonly commit: Commit
  readonly id: string

  constructor(id: string) {
    this.id = id
    this.local = initialTracks(id)
    this.confirmed = this.local
    this.commit = new Commit(async () => {
      const snapshot = this.local
      try {
        await netease.songOrderUpdate(id, snapshot.map(s => s.id))
        this.confirmed = snapshot
      }
      catch (e) {
        this.#failed = snapshot
        this.local = this.confirmed
        toast('顺序没能保存到网易云，已恢复原来的顺序。', { tone: 'error', action: { label: '重试', run: () => this.retry() } })
        throw e
      }
    })
  }

  retry() {
    if (!this.#failed)
      return
    this.local = this.#failed
    this.#failed = null
    this.commit.flush()
  }
}

const trackStore = new Map<string, Tracks>()

export function tracksOf(id: string): Tracks {
  let t = trackStore.get(id)
  if (!t) {
    t = new Tracks(id)
    trackStore.set(id, t)
  }
  return t
}

// ───────────── 曲库：歌单列表、自建歌单的顺序、封面 ─────────────

class Library {
  list = $state.raw<Playlist[]>([...basePlaylists])
  ownOrder = $state.raw<string[]>(basePlaylists.filter(p => p.kind === 'own').map(p => p.id))
  ownConfirmed: string[] = this.ownOrder
  #ownFailed: string[] | null = null
  /** 已经设好的新封面（歌单编号 → blob 地址） */
  covers = $state<Record<string, string>>({})
  #created = 0

  readonly ownCommit = new Commit(async () => {
    const snapshot = this.ownOrder
    try {
      await netease.playlistOrderUpdate(snapshot)
      this.ownConfirmed = snapshot
    }
    catch (e) {
      this.#ownFailed = snapshot
      this.ownOrder = this.ownConfirmed
      toast('歌单顺序没能保存，已恢复原来的顺序。', { tone: 'error', action: { label: '重试', run: () => this.retryOwn() } })
      throw e
    }
  })

  byId(id: string): Playlist | undefined {
    return this.list.find(p => p.id === id)
  }

  get liked(): Playlist {
    return this.list.find(p => p.kind === 'liked')!
  }

  get own(): Playlist[] {
    return this.ownOrder.map(id => this.byId(id)).filter((p): p is Playlist => Boolean(p))
  }

  get collected(): Playlist[] {
    return this.list.filter(p => p.kind === 'collected')
  }

  /** 曲库里歌单的顺序：我喜欢的音乐在最前，然后自建（可以排序），最后收藏 */
  get ordered(): Playlist[] {
    return [this.liked, ...this.own, ...this.collected]
  }

  coverOf(pl: Playlist): string {
    return this.covers[pl.id] ?? pl.cover
  }

  setOwnOrder(ids: string[]) {
    this.ownOrder = ids
    this.ownCommit.touch()
  }

  retryOwn() {
    if (!this.#ownFailed)
      return
    this.ownOrder = this.#ownFailed
    this.#ownFailed = null
    this.ownCommit.flush()
  }

  create(songs: Song[]): Playlist {
    this.#created++
    const pl: Playlist = { id: `pl-new-${this.#created}`, name: `新建歌单 ${this.#created}`, cover: songs[0]?.cover ?? 'pl-umi', kind: 'own', creator: '花火', description: '', tags: [] }
    this.list = [...this.list, pl]
    this.ownOrder = [pl.id, ...this.ownOrder]
    this.ownConfirmed = [pl.id, ...this.ownConfirmed]
    const t = tracksOf(pl.id)
    t.local = songs
    t.confirmed = songs
    return pl
  }
}

export const library = new Library()

// ───────────── 选择 ─────────────

class Selection {
  ids = $state.raw<Set<string>>(new Set())
  /** 显式的选择模式：手机长按之后，或方案 C 的编辑模式 */
  mode = $state(false)
  anchor: string | null = null

  get size(): number {
    return this.ids.size
  }

  has(id: string): boolean {
    return this.ids.has(id)
  }

  set(ids: Iterable<string>) {
    this.ids = new Set(ids)
  }

  toggle(id: string) {
    const next = new Set(this.ids)
    if (next.has(id))
      next.delete(id)
    else next.add(id)
    this.ids = next
    this.anchor = id
  }

  /** Shift 连选：从上次点的那首到这首 */
  range(list: Song[], to: string) {
    const a = this.anchor ? list.findIndex(s => s.id === this.anchor) : -1
    const b = list.findIndex(s => s.id === to)
    if (a < 0 || b < 0) {
      this.toggle(to)
      return
    }
    const [lo, hi] = a < b ? [a, b] : [b, a]
    const next = new Set(this.ids)
    for (let i = lo; i <= hi; i++)
      next.add(list[i].id)
    this.ids = next
  }

  enter(id?: string) {
    this.mode = true
    if (id) {
      this.ids = new Set([...this.ids, id])
      this.anchor = id
    }
  }

  exit() {
    this.mode = false
    this.ids = new Set()
    this.anchor = null
  }
}

export const selection = new Selection()

// ───────────── 下载（属于这台设备，ADR-0006） ─────────────

class Downloads {
  map = $state<Record<string, { state: DownloadState, progress: number }>>({})
  #queue: string[] = []
  #running = false

  stateOf(s: Song): DownloadState | undefined {
    return this.map[s.id]?.state ?? s.download
  }

  progressOf(s: Song): number {
    return this.map[s.id]?.progress ?? (s.download === 'downloading' ? 0.62 : 0)
  }

  enqueue(songs: Song[]) {
    const r = { added: 0, trial: 0, unavailable: 0, done: 0 }
    for (const s of songs) {
      const st = this.stateOf(s)
      if (s.unavailable)
        r.unavailable++
      else if (s.trial)
        r.trial++
      else if (st === 'done')
        r.done++
      else if (st !== 'queued' && st !== 'downloading') {
        this.map[s.id] = { state: 'queued', progress: 0 }
        this.#queue.push(s.id)
        r.added++
      }
    }
    void this.#pump()
    return r
  }

  async #pump() {
    if (this.#running)
      return
    this.#running = true
    while (this.#queue.length) {
      const id = this.#queue.shift()!
      this.map[id] = { state: 'downloading', progress: 0 }
      for (let p = 0.1; p <= 1; p += 0.15) {
        await new Promise(r => setTimeout(r, 90))
        this.map[id].progress = Math.min(1, p)
      }
      this.map[id] = { state: 'done', progress: 1 }
    }
    this.#running = false
  }
}

export const downloads = new Downloads()

// ───────────── 播放（只为显示“正在播放”那一行） ─────────────

export const player = $state({ current: 's0', playing: true })

export function playSong(s: Song) {
  if (s.unavailable)
    return
  player.current = s.id
  player.playing = true
}

// ───────────── 拖动的统计（原型面板显示） ─────────────

export const dragStats = $state({
  active: false,
  engine: '',
  count: 0,
  /** 1 起算 */
  from: 0,
  to: 0,
  startedAt: 0,
  /** 当前自动滚动速度（像素/秒），按页面实际滚动量每 250ms 采样一次，三种实现都一样算 */
  speed: 0,
  /** 这次拖动里最快的自动滚动（行/秒） */
  peakRows: 0,
  scrubbing: false,
  last: '',
  moves: 0,
})

let sampler: ReturnType<typeof setInterval> | undefined

export function beginDragStats(engine: string, from: number, count: number) {
  dragStats.active = true
  dragStats.engine = engine
  dragStats.from = from
  dragStats.to = from
  dragStats.count = count
  dragStats.startedAt = performance.now()
  dragStats.speed = 0
  dragStats.peakRows = 0
  dragStats.scrubbing = false
  clearInterval(sampler)
  let lastY = window.scrollY
  let lastT = performance.now()
  sampler = setInterval(() => {
    const t = performance.now()
    const y = window.scrollY
    const speed = Math.abs(y - lastY) / ((t - lastT) / 1000)
    lastY = y
    lastT = t
    // 快速定位条是跳转，不算自动滚动
    if (dragStats.scrubbing)
      return
    dragStats.speed = speed
    dragStats.peakRows = Math.max(dragStats.peakRows, speed / 56)
  }, 250)
}

export function endDragStats(moved: boolean) {
  clearInterval(sampler)
  const secs = (performance.now() - dragStats.startedAt) / 1000
  dragStats.active = false
  dragStats.speed = 0
  if (moved) {
    dragStats.moves++
    const what = dragStats.count > 1 ? `${dragStats.count} 首` : '1 首'
    const via = dragStats.scrubbing ? '，用了快速定位' : ''
    dragStats.last = `${what}：第 ${dragStats.from.toLocaleString('en-US')} → 第 ${dragStats.to.toLocaleString('en-US')} 首，用时 ${secs.toFixed(1)} 秒，自动滚动最快 ${Math.round(dragStats.peakRows)} 行/秒${via}（${dragStats.engine}）`
  }
}

// ───────────── 弹层 ─────────────

export const ui = $state({
  /** 歌曲的“更多”菜单 */
  menu: null as null | { song: Song, x: number, y: number, sheet: boolean },
  /** 加入歌单 */
  add: null as null | { songs: Song[], x: number, y: number, sheet: boolean },
  /** 批量移除前的确认 */
  confirmRemove: null as null | { ids: string[] },
  panel: false,
  /** 换封面的弹层（读取中 / 出错 / 裁剪 / 上传）开着：CoverFlow 写 */
  coverOpen: false,
})

/** 有弹层、菜单开着：原型切换栏缩成角上的一个面板按钮，方向键也不切方案 */
export function overlayOpen(): boolean {
  return Boolean(ui.menu || ui.add || ui.confirmRemove || ui.coverOpen)
}

/** 批量移除的入口：按原型面板的设置，直接移除（带撤销），或先弹确认 */
export function requestRemove(ids: string[]) {
  if (!ids.length)
    return
  if (settings.removeStyle === 'confirm')
    ui.confirmRemove = { ids }
  else removeSongs(view.pl, ids)
}

// ───────────── 写操作 ─────────────

export function isSortable(pl: Playlist | undefined): boolean {
  return pl?.kind === 'own'
}

/** 拖动结束后由各个引擎调用：本地立即生效，然后排队合并提交 */
export function applyOrder(plId: string, next: Song[]) {
  const t = tracksOf(plId)
  t.local = next
  t.commit.touch()
}

export function removeSongs(plId: string, ids: string[]) {
  const pl = library.byId(plId)
  if (!pl || pl.kind === 'collected')
    return
  const t = tracksOf(plId)
  const idSet = new Set(ids)
  const removed = t.local.map((s, i) => ({ s, i })).filter(x => idSet.has(x.s.id))
  if (!removed.length)
    return
  t.local = t.local.filter(s => !idSet.has(s.id))
  selection.exit()
  const liked = pl.kind === 'liked'
  const n = removed.length

  function restore() {
    const next = [...t.local]
    for (const { s, i } of removed)
      next.splice(Math.min(i, next.length), 0, s)
    t.local = next
  }

  let undone = false
  async function send() {
    if (undone)
      return
    try {
      if (liked)
        await netease.like(ids)
      else await netease.playlistTracks('del', plId, ids)
      t.confirmed = t.confirmed.filter(s => !idSet.has(s.id))
    }
    catch {
      restore()
      toast(liked ? `没能取消红心，已恢复这 ${n} 首。` : `没能从歌单移除，已恢复这 ${n} 首。`, { tone: 'error' })
    }
  }

  const done = liked ? `已取消红心 ${n} 首` : `已从歌单移除 ${n} 首`
  if (settings.removeStyle === 'undo') {
    // 撤销窗口：本地立即移除，5 秒内没撤销才真的提交
    const timer = setTimeout(send, 5000)
    toast(done, {
      duration: 5000,
      action: {
        label: '撤销',
        run: () => {
          undone = true
          clearTimeout(timer)
          restore()
        },
      },
    })
  }
  else {
    void send()
    toast(done)
  }
}

export async function addSongsTo(targetId: string, songs: Song[]) {
  const pl = library.byId(targetId)
  if (!pl)
    return
  const t = tracksOf(targetId)
  const have = new Set(t.local.map(s => s.id))
  const fresh = songs.filter(s => !have.has(s.id))
  const liked = pl.kind === 'liked'
  selection.exit()
  if (!fresh.length) {
    toast(liked ? '这些歌都已经红心过了' : `这些歌都已经在「${pl.name}」里了`)
    return
  }
  const dup = songs.length - fresh.length
  const freshIds = new Set(fresh.map(s => s.id))
  // 网易云把新加的歌放在歌单最前面
  t.local = [...fresh, ...t.local]
  toast(liked ? `已红心 ${fresh.length} 首${dup ? `，${dup} 首本来就红心了` : ''}` : `已加入「${pl.name}」${fresh.length} 首${dup ? `，${dup} 首本来就在` : ''}`)
  try {
    if (liked)
      await netease.like([...freshIds])
    else await netease.playlistTracks('add', targetId, [...freshIds])
    t.confirmed = [...fresh, ...t.confirmed]
  }
  catch {
    t.local = t.local.filter(s => !freshIds.has(s.id))
    toast(liked ? '没能红心，已撤回。' : `没能加入「${pl.name}」，已撤回。`, { tone: 'error' })
  }
}

export function downloadSongs(songs: Song[]) {
  const r = downloads.enqueue(songs)
  selection.exit()
  const parts: string[] = []
  if (r.added)
    parts.push(`已加入下载 ${r.added} 首`)
  if (r.done)
    parts.push(`${r.done} 首已下载过`)
  if (r.trial)
    parts.push(`${r.trial} 首试听歌曲不能下载`)
  if (r.unavailable)
    parts.push(`${r.unavailable} 首无版权`)
  toast(parts.join('；') || '没有可以下载的歌')
}

export function isLiked(id: string): boolean {
  return likedIds().has(id)
}

let likedCache: { list: Song[], set: Set<string> } | null = null
function likedIds(): Set<string> {
  const list = tracksOf('liked').local
  if (likedCache?.list !== list)
    likedCache = { list, set: new Set(list.map(s => s.id)) }
  return likedCache.set
}
