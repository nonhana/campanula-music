import type { Playlist } from '#lib/api/library.js'
import type { WriteResponse } from '#lib/api/write.js'
import type { Clock, PageVisibility } from './browser'
import type { Change, ConfirmedChange, DeferredChange } from './changes'
import type { ChangeFailure } from './library'
import type { LocalDb, Replica } from './local'
import type { OperationNotice } from './notice'
import type { SessionResult, SessionRound } from './session-round'
import { endpoints } from '#lib/api/endpoints.js'
import { canSortPlaylist, reorderSortable, TRACKS_PER_CHANGE } from '#lib/api/library.js'
import { targetOf } from './changes'

// 晚一点才提交的修改（Spec #11“客户端：晚一点才提交的修改”，#70）：多选移除（5 秒撤销）、
// 歌单内排序和自建歌单排序（停手 2 秒合并）、页面隐藏时立即提交、关掉再打开恢复没确认的改动。
// 三种修改只有“停手多久、提交什么、网易云回来怎么办”不同，其余（计时、合并、按目标排队、keepalive、
// 未确认标记与恢复、重试记忆、退出作废）都在这里写一份。
// 请求都走会话一轮（SessionRound.api）：换轮后回来的旧回复直接丢掉，不会写进新一轮。
// keepalive 只把标记交给 Api；请求体超过 64 KiB 时 Api 自己退回普通请求（api.ts）。

/** 多选移除的提示条留多久（毫秒）：这之内可以撤销，过了才提交 */
const REMOVE_UNDO_MS = 5000
/** 拖动排序停手多久（毫秒）以后才提交：这之内再拖，合并成一次 */
const ORDER_MERGE_MS = 2000

type RemoveChange = Extract<DeferredChange, { kind: 'remove' }>
type OrderChange = Extract<DeferredChange, { kind: 'order' }>
type PlaylistOrderChange = Extract<DeferredChange, { kind: 'playlistOrder' }>
type Outcome = SessionResult<WriteResponse>
/** 这一轮还在时网易云回来的结果 */
type Answer = Exclude<Outcome, null>

/** 写进副本的一个修改（听众做的，或者网易云建好的新歌单、换好的封面）：网易云确认的那一刻（还没确认是 null），写进副本了没有 */
export interface PendingChange {
  change: ConfirmedChange
  confirmedAt: number | null
  saved: boolean
}

/** 一份还没提交的修改：显示着的这一份、正在提交的那一份、计时和排队 */
interface Pending<C extends DeferredChange> {
  /** 最新要提交的修改 */
  change: C
  /** 显示着的这一份修改；提交中又改了时会换一份新的 */
  entry: PendingChange
  /** 正在提交的那一份修改 */
  sendingEntry: PendingChange | null
  /** 取消计时 */
  cancelTimer: () => void
  /** 已经开始提交：同一份不重复发 */
  sending: Promise<void> | null
  /** 处理完了（提交成功、失败退回了、这一轮作废了）：不再提交 */
  settled: boolean
  /** 开始提交时收起上一次失败的提示 */
  begin: () => void
  /** 处理完了：从自己那一组里拿掉 */
  finish: (mine: number) => void
  /** 意外出错（请求、本机数据库）：按没成功处理 */
  failed: (mine: number, failure: ChangeFailure) => void
}

/** 一批还没提交的移除：removalId 认这一批，提示条的撤销和合并都只认这个编号，不当载荷的副本 */
interface PendingRemoval extends Pending<RemoveChange> {
  removalId: number
}

/** 一种修改自己的东西：停手多久、提交什么、网易云回来了处理完没有（true：提交中又改了，接着发最新的一份） */
interface Policy<C extends DeferredChange> {
  window: number
  change: (item: Pending<C>) => C
  settle: (mine: number, item: Pending<C>, entry: PendingChange, sent: C, result: Answer) => Promise<boolean>
}

/** 恢复上次没确认的改动时，重拉一张歌单的结果（见 Deferred.recover） */
type Recovered = 'recovered' | 'missing' | 'failed' | 'stopped'

export interface DeferredContext {
  clock: Clock
  page: PageVisibility
  local: LocalDb
  session: SessionRound
  /** 显示着的副本（叠上还没确认的修改）；没登录时 null */
  shown: () => Replica | null
  /** 本机副本（没有叠修改的）；没登录时 null */
  replica: () => Replica | null
  /** 还没确认的修改：叠到显示着的副本上、拿掉、确认后写进本机副本 */
  overlay: {
    add: (entry: PendingChange) => void
    remove: (match: (change: ConfirmedChange) => boolean) => void
    confirm: (mine: number, entry: PendingChange, change: Change) => Promise<boolean>
  }
  /** 重新发布曲库状态 */
  publish: () => void
  /** 换掉提示条（App 的提示条负责重新发布） */
  notify: (notice: OperationNotice | null) => void
  /** 当前提示条：提交前要看清掉的是不是自己的那一条 */
  notice: () => OperationNotice | null
  /** 马上同步一次曲库（歌单在网易云里不在了） */
  sync: () => void
  /** 浏览器觉得联网着（navigator.onLine） */
  online: () => boolean
}

export interface Deferred {
  /** 同一样东西的修改按先后一次一个：立即修改和晚一点提交的都走这一条队；上一件失败也不堵后面 */
  serialize: <T>(target: string, job: () => Promise<T>) => Promise<T>
  /** 等这个目标当前的队排完（打开歌单前看它在不在曲库里） */
  settled: (target: string) => Promise<void>
  /**
   * 从自建歌单移除几首：先改本地，5 秒内可以撤销，没撤销才提交。
   * 已经不在本机曲目里的编号会被过滤；超过 TRACKS_PER_CHANGE 或断网时不改本地，只说明原因
   */
  remove: (playlist: Playlist, songIds: readonly number[]) => void
  /** 撤销提示条上的这一批移除（载荷里的 removalId）：整批放回原位，什么都不提交 */
  undoRemove: (removalId: number) => void
  /** 听众主动关掉提示条：如果关的是“撤销”那一条，忘掉它指向哪一批（计时和提交不受影响） */
  dismiss: () => void
  /** 5 秒撤销窗口里把这些歌加回来：从待提交的移除里拿掉，返回拿掉的编号 */
  restore: (playlistId: number, songIds: readonly number[]) => Set<number>
  /** 重试提示条上没成功的移除（载荷里的歌单、编号）：重新从本地拿掉，马上提交 */
  retryRemove: (playlist: Playlist, songIds: readonly number[]) => Promise<void>
  /**
   * 把整张歌单的新顺序先改本地，停手 2 秒合并提交；返回顺序有没有改。
   * 断网、歌单不能排序、要挪的歌不在列表里时返回 false，不改本地
   */
  moveSongs: (playlistId: number, songIds: readonly number[], before: number | null) => boolean
  /** 重试提示条上没保存成功的排序（载荷里的歌单、顺序）：恢复刚才的顺序，马上提交 */
  retryOrder: (playlist: Playlist, songIds: readonly number[]) => Promise<void>
  /** 曲库里自建歌单之间的排序：只收全部自建歌单的先后，我喜欢的音乐由模块放在最前；不是这些时抛错 */
  orderPlaylists: (playlistIds: readonly number[]) => boolean
  /** 重试提示条上没保存成功的自建歌单顺序（载荷里的先后）：恢复刚才的顺序，马上提交 */
  retryPlaylistOrder: (playlistIds: readonly number[]) => Promise<void>
  /** 页面隐藏（全部）或离开歌单（这一张）：把还没提交的修改立即提交 */
  flush: (playlistId?: number) => Promise<void>
  /**
   * 上次关掉前没确认的改动：同步拿到歌单列表以后重拉这几张、丢掉本地改动。每种结果对本地的影响：
   * - recovered：重拉成功，标记划掉，这张歌单的本地改动被网易云的覆盖，提示“已恢复原样”；
   * - missing：这张歌单在网易云里已经不在了，标记划掉，参与“已恢复原样”；
   * - failed：重拉没成功，标记留着，下一次同步/下次打开再试，不提示；
   * - stopped：这一轮已经结束，停止恢复，标记留在本机，下次打开再试。
   */
  recover: (mine: number, reload: (playlistId: number) => Promise<Recovered>) => Promise<void>
  /** 刚打开：接上本机记着的未确认歌单 */
  resume: (playlistIds: readonly number[]) => void
  /**
   * 退出、登录失效、换账号：作废本标签页的计时和队列。
   * 本机记着的未确认标记不在 `pending` 里，留给恢复流程（同账号下次打开时重拉）；不在这里删
   */
  forget: () => void
}

function sameOrder(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function entryOf(change: Change): PendingChange {
  return { change, confirmedAt: null, saved: false }
}

/** 曲库里能排序的歌单，按当前的先后：我喜欢的音乐在最前，然后是自建歌单 */
function sortablePlaylists(current: Replica): Playlist[] | null {
  if (!current.playlists)
    return null
  const sortable = current.playlists.filter(playlist => canSortPlaylist(playlist.kind))
  return [...sortable.filter(playlist => playlist.kind === 'liked'), ...sortable.filter(playlist => playlist.kind !== 'liked')]
}

/** 过期、缺了几张的顺序补成能提交的：还在的照提交的先后，没出现的按原来的先后接在后面 */
function normalizedPlaylistOrder(current: Replica, playlistIds: readonly number[]): number[] {
  const sortable = sortablePlaylists(current) ?? []
  return reorderSortable(sortable, playlistIds, () => true).map(playlist => playlist.id)
}

/** 自建歌单顺序不对时抛的错：调用方只该传全部自建歌单的编号（编程错误，不静默修好） */
function orderProblem(own: readonly Playlist[], playlistIds: readonly number[]): string | null {
  if (playlistIds.length !== own.length)
    return `自建歌单顺序不对：要 ${own.length} 张，给了 ${playlistIds.length} 张`
  if (new Set(playlistIds).size !== playlistIds.length)
    return '自建歌单顺序里有重复的编号'
  const allowed = new Set(own.map(playlist => playlist.id))
  const unknown = playlistIds.find(id => !allowed.has(id))
  return unknown === undefined ? null : `自建歌单顺序里混进了不是自建歌单的编号：${unknown}`
}

/** 晚一点才提交的修改在本标签页的全部状态：退出、换账号时整体换掉（本机标记不在里面） */
interface PendingState {
  /** 多选移除：本地已经拿掉、还没提交的 */
  removals: PendingRemoval[]
  /**
   * 当前（或最近一条被别的提示替换掉的）“撤销”提示指向哪一批；只用来找“上一批是谁”，
   * 不是提示内容的第二份存储（提示载荷里的 removalId 才是界面看到的那一批）
   */
  noticeRemovalId: number | null
  /** 拖动排序：本地已经改了、还没提交的，一张歌单一份 */
  orders: Map<number, Pending<OrderChange>>
  /** 自建歌单之间的顺序：本地已经改了、还没提交的 */
  playlistOrder: Pending<PlaylistOrderChange> | null
  /** 上次关闭前没确认的歌单：同步拿到歌单列表后先从网易云重拉这几张 */
  recovering: Set<number>
  /** 这个标签页已经写进本机的标记：只增删自己写的那几张，别的标签页记下的不动 */
  writtenMarkers: Set<number>
}

function freshPending(): PendingState {
  return {
    removals: [],
    noticeRemovalId: null,
    orders: new Map(),
    playlistOrder: null,
    recovering: new Set(),
    writtenMarkers: new Set(),
  }
}

export function createDeferred(context: DeferredContext): Deferred {
  const { clock, local, session } = context
  let pending = freshPending()
  /** 这个标签页里每一批移除的编号：只增不减，换轮也不重用 */
  let nextRemovalId = 1
  /** 未确认标记一步一步写，免得几次写交错、后写的拿着旧的一组把前面的盖掉 */
  let markerSaving: Promise<void> = Promise.resolve()
  /** 同一样东西的修改按先后一个一个做：上一次连同收尾做完的那一刻 */
  const queues = new Map<string, Promise<void>>()

  /** 丢掉本标签页的全部待提交状态：计时、队列里的那一份；本机标记留给恢复流程 */
  function resetPending(): void {
    for (const item of pending.removals) {
      item.settled = true
      item.cancelTimer()
    }
    for (const item of pending.orders.values()) {
      item.settled = true
      item.cancelTimer()
    }
    if (pending.playlistOrder) {
      pending.playlistOrder.settled = true
      pending.playlistOrder.cancelTimer()
    }
    pending = freshPending()
  }

  function show(notice: OperationNotice | null): void {
    context.notify(notice)
  }

  function serialize<T>(target: string, job: () => Promise<T>): Promise<T> {
    const before = queues.get(target) ?? Promise.resolve()
    const run = before.then(job)
    const tail = run.then(() => {}, () => {})
    queues.set(target, tail)
    void tail.then(() => {
      if (queues.get(target) === tail)
        queues.delete(target)
    })
    return run
  }

  async function settled(target: string): Promise<void> {
    let tail = queues.get(target)
    while (tail) {
      await tail
      tail = queues.get(target)
    }
  }

  /**
   * 本机记的“这几张歌单有改动还没确认”：正在提交的、上次关掉前没确认完的。
   * 只加/删这个标签页写过的，别的标签页同时在改别的歌单时不会被盖掉
   */
  function saveMarkers(mine: number): Promise<void> {
    const current = context.replica()
    if (!current)
      return Promise.resolve()
    markerSaving = markerSaving.then(async () => {
      if (!session.isCurrent(mine) || !context.replica())
        return
      // 自建歌单之间的顺序没有对应的歌单：不记 pendingChanges
      const active = new Set([...pending.recovering, ...pending.removals.map(item => item.change.playlist.id), ...pending.orders.keys()])
      for (const id of active) {
        if (pending.writtenMarkers.has(id))
          continue
        await local.addPendingChange(current.owner, id)
        pending.writtenMarkers.add(id)
      }
      for (const id of [...pending.writtenMarkers]) {
        if (active.has(id))
          continue
        await local.removePendingChange(current.owner, id)
        pending.writtenMarkers.delete(id)
      }
    }).catch(() => {})
    return markerSaving
  }

  /** 停手 window 毫秒后提交这一份；重新计时会取消上一份 */
  function schedule<C extends DeferredChange>(mine: number, item: Pending<C>, policy: Policy<C>): void {
    item.cancelTimer()
    item.cancelTimer = clock.after(policy.window, () => {
      void commit(mine, item, policy, { keepalive: false })
    })
  }

  /** 提交一份修改：成功后接着发最新的，或者收尾。三种修改共用这一份骨架 */
  async function commit<C extends DeferredChange>(mine: number, item: Pending<C>, policy: Policy<C>, { keepalive, immediate = false }: { keepalive: boolean, immediate?: boolean }): Promise<void> {
    if (item.settled)
      return
    if (item.sending)
      return item.sending
    item.cancelTimer()
    item.begin()
    const target = targetOf(policy.change(item))
    const job = serialize(target, async () => {
      try {
        // 提交前先让“这张歌单有改动还没确认”落盘：这时关掉页面，下次打开才知道要恢复
        await markerSaving
        for (;;) {
          if (item.settled || !session.isCurrent(mine))
            return
          const entry = item.entry
          const sent = policy.change(item)
          item.sendingEntry = entry
          const result = await submit(mine, sent, keepalive)
          if (!result || item.settled || !session.isCurrent(mine))
            return
          if (!await policy.settle(mine, item, entry, sent, result))
            return
          // 等回复的这段时间里这一轮可能结束了（退出、登录失效）：作废的那一份不再排下一份
          if (item.settled || !session.isCurrent(mine))
            return
          // 提交中又改了：等一个合并窗口，没再改才发最新的一份
          if (immediate)
            continue
          schedule(mine, item, policy)
          return
        }
      }
      catch {
        // 本机数据库、请求本身出了意料之外的错：也按没成功处理
        if (!item.settled && session.isCurrent(mine))
          item.failed(mine, { kind: 'serverError' })
      }
    })
    item.sending = job.finally(() => {
      item.sending = null
    })
    return item.sending
  }

  /** 把这些修改提交给网易云（前台请求）；这一轮已经结束就不发 */
  function submit(mine: number, change: RemoveChange | OrderChange | PlaylistOrderChange, keepalive: boolean): Promise<Outcome> {
    if (!session.isCurrent(mine))
      return Promise.resolve(null)
    const options = keepalive ? { keepalive: true } : undefined
    switch (change.kind) {
      case 'remove':
        return session.api.post(endpoints.removeTracks, { id: change.playlist.id }, { songIds: change.songIds }, options)
      case 'order':
        return session.api.post(endpoints.songOrder, { id: change.playlist.id }, { songIds: change.songIds }, options)
      case 'playlistOrder':
        return session.api.post(endpoints.playlistOrder, { playlistIds: change.playlistIds }, options)
    }
  }

  /** 网易云确认了显示着的这一份：写进副本；提交中又改了的话返回 true，接着发最新的 */
  async function accepted<C extends DeferredChange>(mine: number, item: Pending<C>, entry: PendingChange, sent: C): Promise<boolean> {
    if (!await context.overlay.confirm(mine, entry, sent))
      return false
    item.sendingEntry = null
    if (item.entry === entry) {
      item.finish(mine)
      context.publish()
      return false
    }
    return true
  }

  /**
   * 网易云回了 -1 或者超时：重新读一次这张歌单，和提交的顺序一样就算成功（几千首位置都变时其实已经生效）。
   * 重读没成功、或者顺序不一样都是没有生效
   */
  async function orderLanded(playlistId: number, songIds: readonly number[]): Promise<boolean> {
    const result = await session.api.get(endpoints.trackIds, { id: playlistId })
    if (!result?.ok)
      return false
    // 提交的顺序可能过期：多出来的歌（还在提交中的加入、红心）会被网易云忽略，漏掉的歌原地保留。
    // 只比两边都有的歌的先后；一首都没有对上时不能算成功
    const upstream = new Set(result.value.trackIds)
    const submitted = new Set(songIds)
    const common = result.value.trackIds.filter(id => submitted.has(id))
    const expected = songIds.filter(id => upstream.has(id))
    return common.length > 0 && sameOrder(expected, common)
  }

  /** 排序没成功：去掉这张歌单的排序修改（本地退回原来的顺序），提示条带上“重试”用的顺序 */
  function orderFailed(mine: number, item: Pending<OrderChange>, failure: ChangeFailure | null): void {
    if (!session.isCurrent(mine))
      return
    const { playlist, songIds } = item.change
    context.overlay.remove(change => change.kind === 'order' && change.playlist.id === playlist.id)
    item.finish(mine)
    show({ kind: 'orderFailed', playlist, songIds: [...songIds], failure })
  }

  /** 排序时网易云说这张歌单已经不在了：退回原来的顺序，马上同步一次曲库 */
  function orderMissing(mine: number, item: Pending<OrderChange>, sent: OrderChange): void {
    if (!session.isCurrent(mine))
      return
    context.overlay.remove(change => change.kind === 'order' && change.playlist.id === sent.playlist.id)
    item.finish(mine)
    show({ kind: 'playlistMissing', change: sent })
    context.sync()
  }

  /** 自建歌单顺序没成功：去掉这次的修改（本地退回原来的顺序），提示条带上“重试”用的顺序 */
  function playlistOrderFailed(mine: number, item: Pending<PlaylistOrderChange>, failure: ChangeFailure): void {
    if (!session.isCurrent(mine))
      return
    const playlistIds = [...item.change.playlistIds]
    context.overlay.remove(change => change.kind === 'playlistOrder')
    item.finish(mine)
    show({ kind: 'playlistOrderFailed', playlistIds, failure })
  }

  const removalPolicy: Policy<RemoveChange> = {
    window: REMOVE_UNDO_MS,
    change: item => item.change,
    async settle(mine, item, entry, sent, result) {
      if (result.ok && result.value.kind === 'done')
        return accepted(mine, item, entry, sent)
      // 失败、歌单不在了：本地已经改回原样
      context.overlay.remove(change => change === entry.change)
      item.finish(mine)
      if (result.ok && result.value.kind === 'missing') {
        show({ kind: 'playlistMissing', change: sent })
        context.sync()
        return false
      }
      // 只有整张歌单排序会回 unconfirmed（write.ts）：移除遇到它按没成功处理
      const failure: ChangeFailure = result.ok ? { kind: 'neteaseUnavailable' } : result.failure
      show({ kind: 'removeFailed', playlist: sent.playlist, count: sent.songIds.length, songIds: [...sent.songIds], failure })
      return false
    },
  }

  const orderPolicy: Policy<OrderChange> = {
    window: ORDER_MERGE_MS,
    change: item => item.change,
    async settle(mine, item, entry, sent, result) {
      if (result.ok && result.value.kind === 'done')
        return accepted(mine, item, entry, sent)
      if (result.ok && result.value.kind === 'unconfirmed') {
        if (await orderLanded(sent.playlist.id, sent.songIds))
          return accepted(mine, item, entry, sent)
        orderFailed(mine, item, null)
        return false
      }
      if (!result.ok && result.failure.kind === 'neteaseUnavailable') {
        if (await orderLanded(sent.playlist.id, sent.songIds))
          return accepted(mine, item, entry, sent)
        orderFailed(mine, item, result.failure)
        return false
      }
      if (result.ok) {
        orderMissing(mine, item, sent)
        return false
      }
      orderFailed(mine, item, result.failure)
      return false
    },
  }

  const playlistOrderPolicy: Policy<PlaylistOrderChange> = {
    window: ORDER_MERGE_MS,
    change: item => item.change,
    async settle(mine, item, entry, sent, result) {
      if (result.ok)
        return accepted(mine, item, entry, sent)
      playlistOrderFailed(mine, item, result.failure)
      return false
    },
  }

  function startRemoval(mine: number, playlist: Playlist, songIds: readonly number[]): PendingRemoval {
    const change: RemoveChange = { kind: 'remove', playlist, songIds: [...songIds] }
    const entry = entryOf(change)
    const removalId = nextRemovalId++
    const item: PendingRemoval = {
      change,
      entry,
      removalId,
      sendingEntry: null,
      cancelTimer: () => {},
      sending: null,
      settled: false,
      begin: () => {
        // 开始提交了：撤销不了了，忘掉这一批，收起这一条的“撤销”提示（换了别的提示条就不动）
        if (pending.noticeRemovalId === item.removalId)
          pending.noticeRemovalId = null
        const current = context.notice()
        if (current?.kind === 'removed' && current.removalId === item.removalId)
          show(null)
      },
      finish: (mine) => {
        item.settled = true
        item.cancelTimer()
        pending.removals = pending.removals.filter(each => each !== item)
        if (pending.noticeRemovalId === item.removalId)
          pending.noticeRemovalId = null
        void saveMarkers(mine)
      },
      failed: (mine, failure) => {
        if (item.settled || !session.isCurrent(mine))
          return
        context.overlay.remove(change => change === item.entry.change)
        item.finish(mine)
        const { playlist, songIds } = item.change
        show({ kind: 'removeFailed', playlist, count: songIds.length, songIds: [...songIds], failure })
      },
    }
    context.overlay.add(entry)
    pending.removals.push(item)
    // retry 也先记上；commit 一开始 begin 就会清掉，不会留下指不到提示的假撤销引用
    pending.noticeRemovalId = removalId
    void saveMarkers(mine)
    return item
  }

  /** 先从本地拿掉，记下未确认；undo 时提示条留 5 秒撤销，否则马上提交（retry 用） */
  function applyRemoval(mine: number, playlist: Playlist, songIds: readonly number[], { undo }: { undo: boolean }): PendingRemoval {
    // 5 秒内又移除了一批：同一张歌单合成一条提示（撤销两批一起放回，计时从头算）；
    // 不同歌单的先提交上一批，别让它悄悄在后面提交、撤销不到了。
    // “上一批”看私有的 noticeRemovalId：提示条被 added 等换掉以后它仍然记着，和基线一样会先提交
    if (undo) {
      const previousId = pending.noticeRemovalId
      const previous = previousId === null
        ? undefined
        : pending.removals.find(each => each.removalId === previousId && !each.settled && !each.sending)
      if (previous) {
        if (previous.change.playlist.id === playlist.id) {
          const combined = [...new Set([...previous.change.songIds, ...songIds])]
          previous.change.songIds = combined
          schedule(mine, previous, removalPolicy)
          show({ kind: 'removed', playlist, count: combined.length, removalId: previous.removalId })
          return previous
        }
        void commit(mine, previous, removalPolicy, { keepalive: false })
      }
    }
    const item = startRemoval(mine, playlist, songIds)
    if (undo) {
      show({ kind: 'removed', playlist, count: songIds.length, removalId: item.removalId })
      schedule(mine, item, removalPolicy)
    }
    else {
      show(null)
    }
    return item
  }

  function remove(playlist: Playlist, songIds: readonly number[]): void {
    const current = context.replica()
    if (!current)
      return
    const tracks = current.tracks.get(playlist.id)
    const present = new Set(tracks?.trackIds ?? [])
    const ids = [...new Set(songIds)].filter(id => present.has(id))
    if (ids.length === 0)
      return
    const mine = session.current
    if (ids.length > TRACKS_PER_CHANGE) {
      show({ kind: 'removeFailed', playlist, count: ids.length, songIds: ids, failure: { kind: 'invalid', problem: 'tooManySongs' } })
      return
    }
    if (!context.online()) {
      // 断网时的写操作直接说没改成，不改本地（规则⑨）
      show({ kind: 'removeFailed', playlist, count: ids.length, songIds: ids, failure: { kind: 'offline' } })
      return
    }
    applyRemoval(mine, playlist, ids, { undo: true })
  }

  /** 撤销提示条上的这一批移除（载荷里的 removalId）：整批放回原位；这一批就撤完了时连计时一起停掉 */
  function undoRemove(removalId: number): void {
    const item = pending.removals.find(each => each.removalId === removalId && !each.settled && !each.sending)
    if (!item)
      return
    item.settled = true
    item.cancelTimer()
    context.overlay.remove(change => change === item.entry.change)
    pending.removals = pending.removals.filter(each => each !== item)
    if (pending.noticeRemovalId === removalId)
      pending.noticeRemovalId = null
    const current = context.notice()
    if (current?.kind === 'removed' && current.removalId === removalId)
      show(null)
    context.publish()
    void saveMarkers(session.current)
  }

  /** 听众主动关掉提示条：关的是“撤销”那一条时忘掉它指向哪一批；计时和提交不受影响 */
  function dismiss(): void {
    const current = context.notice()
    if (current?.kind === 'removed' && pending.noticeRemovalId === current.removalId)
      pending.noticeRemovalId = null
  }

  /**
   * 把这张歌单的待提交移除里的这几首拿掉（重新加入歌单时用）：别的歌继续按 5 秒计时，拿掉的放回原位。
   * 和基线一样遍历这张歌单的全部待提交移除（提示被关掉、换掉以后也能把前一批加回来）；
   * removalId / noticeRemovalId 只决定当前那条“撤销”提示要不要更新、指针什么时候清，不拿来筛候选。
   */
  function restore(playlistId: number, songIds: readonly number[]): Set<number> {
    const ids = new Set(songIds)
    const restored = new Set<number>()
    for (const item of [...pending.removals]) {
      if (item.change.playlist.id !== playlistId || item.sending)
        continue
      const overlap = item.change.songIds.filter(id => ids.has(id))
      if (overlap.length === 0)
        continue
      for (const id of overlap)
        restored.add(id)
      const remaining = item.change.songIds.filter(id => !ids.has(id))
      if (remaining.length === 0) {
        item.settled = true
        item.cancelTimer()
        context.overlay.remove(change => change === item.entry.change)
        pending.removals = pending.removals.filter(each => each !== item)
        if (pending.noticeRemovalId === item.removalId)
          pending.noticeRemovalId = null
      }
      else {
        item.change.songIds = remaining
      }
      const current = context.notice()
      if (current?.kind === 'removed' && current.removalId === item.removalId) {
        show(remaining.length > 0
          ? { kind: 'removed', playlist: item.change.playlist, count: remaining.length, removalId: item.removalId }
          : null)
      }
    }
    if (restored.size > 0) {
      const playlist = context.replica()?.playlists?.find(each => each.id === playlistId)
      if (playlist)
        show({ kind: 'alreadyAdded', playlist })
      void saveMarkers(session.current)
    }
    return restored
  }

  async function retryRemove(playlist: Playlist, songIds: readonly number[]): Promise<void> {
    // 用当前副本里的这一张：提示条可能开了一阵，名字、作者已经变了。
    // 歌单已经不在当前副本里（在别处删了）就不提交，和 retryOrder 一样，等同步/恢复流程处理
    const fresh = context.replica()?.playlists?.find(item => item.id === playlist.id)
    if (!fresh)
      return
    if (!context.online()) {
      show({ kind: 'removeFailed', playlist: fresh, count: songIds.length, songIds: [...songIds], failure: { kind: 'offline' } })
      return
    }
    const mine = session.current
    const item = applyRemoval(mine, fresh, songIds, { undo: false })
    await commit(mine, item, removalPolicy, { keepalive: false })
  }

  function startOrder(mine: number, playlist: Playlist, songIds: readonly number[]): Pending<OrderChange> {
    const change: OrderChange = { kind: 'order', playlist, songIds: [...songIds] }
    const entry = entryOf(change)
    const item: Pending<OrderChange> = {
      change,
      entry,
      sendingEntry: null,
      cancelTimer: () => {},
      sending: null,
      settled: false,
      begin: () => {
        const current = context.notice()
        if (current?.kind === 'orderFailed' && current.playlist.id === item.change.playlist.id)
          show(null)
      },
      finish: (mine) => {
        item.settled = true
        item.cancelTimer()
        item.sendingEntry = null
        pending.orders.delete(item.change.playlist.id)
        void saveMarkers(mine)
      },
      failed: (mine, failure) => {
        orderFailed(mine, item, failure)
      },
    }
    pending.orders.set(playlist.id, item)
    context.overlay.add(entry)
    schedule(mine, item, orderPolicy)
    return item
  }

  /**
   * 往已有的一份修改里合并新的载荷：正在提交时换一份新的显示着的修改，等这一份回来再发；
   * 没在提交就改显示着的那一份，停手计时从头算
   */
  function mergePending<C extends DeferredChange>(item: Pending<C>, change: C, mine: number, policy: Policy<C>): void {
    item.change = change
    if (item.sending) {
      if (item.entry === item.sendingEntry) {
        item.entry = entryOf(change)
        context.overlay.add(item.entry)
      }
      else {
        item.entry.change = change
      }
      return
    }
    item.entry.change = change
    schedule(mine, item, policy)
  }

  function moveSongs(playlistId: number, songIds: readonly number[], before: number | null): boolean {
    const current = context.replica()
    const display = context.shown()
    if (!current || !display)
      return false
    const playlist = current.playlists?.find(item => item.id === playlistId)
    if (!playlist || !canSortPlaylist(playlist.kind))
      return false
    const tracks = display.tracks.get(playlistId)
    if (!tracks)
      return false
    const moved = new Set(songIds)
    const moving = tracks.trackIds.filter(id => moved.has(id))
    if (moving.length === 0)
      return false
    const rest = tracks.trackIds.filter(id => !moved.has(id))
    const at = before === null ? rest.length : rest.indexOf(before)
    if (at < 0)
      return false
    const next = [...rest.slice(0, at), ...moving, ...rest.slice(at)]
    if (sameOrder(next, tracks.trackIds))
      return false
    if (!context.online()) {
      // 断网时先不改本地（规则⑨）；连上网络后点“重试”再把这次拖动排进去、提交
      show({ kind: 'orderFailed', playlist, songIds: next, failure: { kind: 'offline' } })
      return false
    }
    const mine = session.current
    const item = pending.orders.get(playlistId)
    if (item && !item.settled)
      mergePending(item, { kind: 'order', playlist, songIds: next }, mine, orderPolicy)
    else
      startOrder(mine, playlist, next)
    const currentNotice = context.notice()
    if (currentNotice?.kind === 'orderFailed' && currentNotice.playlist.id === playlistId)
      show(null)
    context.publish()
    void saveMarkers(mine)
    return true
  }

  function orderPlaylists(playlistIds: readonly number[]): boolean {
    const current = context.replica()
    const display = context.shown()
    if (!current || !display?.playlists)
      return false
    const own = display.playlists.filter(playlist => playlist.kind === 'own')
    const problem = orderProblem(own, playlistIds)
    if (problem)
      throw new Error(problem)
    const liked = display.playlists.find(playlist => playlist.kind === 'liked')
    // 我喜欢的音乐固定在最前：界面只传自建歌单，拼接在这里
    const next = liked ? [liked.id, ...playlistIds] : [...playlistIds]
    const displayed = sortablePlaylists(display)
    if (displayed && sameOrder(next, displayed.map(playlist => playlist.id)))
      return false
    const mine = session.current
    const item = pending.playlistOrder
    // 拖回原来的顺序、还没开始提交：撤掉这份修改，什么都不发
    const base = sortablePlaylists(current)
    if (base && sameOrder(next, base.map(playlist => playlist.id))) {
      if (!item || item.settled)
        return false
      if (!item.sending) {
        context.overlay.remove(change => change === item.entry.change)
        item.finish(mine)
        show(null)
        context.publish()
        return true
      }
    }
    if (!context.online()) {
      // 断网时先不改本地（规则⑨）；连上网络后点“重试”再把这次拖动排进去、提交
      show({ kind: 'playlistOrderFailed', playlistIds: next, failure: { kind: 'offline' } })
      return false
    }
    if (item && !item.settled)
      mergePending(item, { kind: 'playlistOrder', playlistIds: next }, mine, playlistOrderPolicy)
    else
      startPlaylistOrder(mine, next)
    if (context.notice()?.kind === 'playlistOrderFailed')
      show(null)
    context.publish()
    return true
  }

  function startPlaylistOrder(mine: number, playlistIds: readonly number[]): Pending<PlaylistOrderChange> {
    const change: PlaylistOrderChange = { kind: 'playlistOrder', playlistIds: [...playlistIds] }
    const entry = entryOf(change)
    const item: Pending<PlaylistOrderChange> = {
      change,
      entry,
      sendingEntry: null,
      cancelTimer: () => {},
      sending: null,
      settled: false,
      begin: () => {
        if (context.notice()?.kind === 'playlistOrderFailed')
          show(null)
      },
      finish: (mine) => {
        item.settled = true
        item.cancelTimer()
        item.sendingEntry = null
        if (pending.playlistOrder === item)
          pending.playlistOrder = null
        void saveMarkers(mine)
      },
      failed: (mine, failure) => {
        playlistOrderFailed(mine, item, failure)
      },
    }
    pending.playlistOrder = item
    context.overlay.add(entry)
    schedule(mine, item, playlistOrderPolicy)
    return item
  }

  async function retryOrder(playlist: Playlist, songIds: readonly number[]): Promise<void> {
    const current = context.replica()
    if (!current)
      return
    // 用当前的歌单列表里的这一张：提示条可能开了一阵，名字、更新时间已经变了
    const found = current.playlists?.find(item => item.id === playlist.id)
    if (!found)
      return
    if (!context.online()) {
      show({ kind: 'orderFailed', playlist: found, songIds, failure: { kind: 'offline' } })
      return
    }
    const mine = session.current
    const item = startOrder(mine, found, songIds)
    show(null)
    context.publish()
    void saveMarkers(mine)
    await commit(mine, item, orderPolicy, { keepalive: false, immediate: true })
  }

  async function retryPlaylistOrder(playlistIds: readonly number[]): Promise<void> {
    const current = context.replica()
    if (!current)
      return
    if (!context.online()) {
      show({ kind: 'playlistOrderFailed', playlistIds, failure: { kind: 'offline' } })
      return
    }
    const mine = session.current
    const item = startPlaylistOrder(mine, normalizedPlaylistOrder(current, playlistIds))
    show(null)
    context.publish()
    await commit(mine, item, playlistOrderPolicy, { keepalive: false, immediate: true })
  }

  async function flush(playlistId?: number): Promise<void> {
    const mine = session.current
    await Promise.all([
      ...pending.removals
        .filter(item => playlistId === undefined || item.change.playlist.id === playlistId)
        .map(item => commit(mine, item, removalPolicy, { keepalive: true })),
      ...[...pending.orders.values()]
        .filter(item => playlistId === undefined || item.change.playlist.id === playlistId)
        .map(item => commit(mine, item, orderPolicy, { keepalive: true, immediate: true })),
      ...(playlistId === undefined && pending.playlistOrder ? [commit(mine, pending.playlistOrder, playlistOrderPolicy, { keepalive: true, immediate: true })] : []),
    ])
  }

  async function recover(mine: number, reload: (playlistId: number) => Promise<Recovered>): Promise<void> {
    if (pending.recovering.size === 0)
      return
    let recovered = false
    for (const id of [...pending.recovering]) {
      if (!session.isCurrent(mine))
        return
      const result = await reload(id)
      if (result === 'stopped')
        return
      if (result === 'failed')
        continue
      pending.recovering.delete(id)
      recovered = true
    }
    if (recovered && session.isCurrent(mine))
      show({ kind: 'recovered' })
    await saveMarkers(mine)
  }

  function resume(playlistIds: readonly number[]): void {
    pending.recovering = new Set(playlistIds)
    pending.writtenMarkers = new Set(pending.recovering)
  }

  function forget(): void {
    resetPending()
    queues.clear()
  }

  // 页面被隐藏（切到后台、锁屏、关页面）：不等计时器，立即提交
  context.page.addEventListener('visibilitychange', () => {
    if (context.page.visibilityState === 'hidden')
      void flush()
  })

  return {
    serialize,
    settled,
    remove,
    undoRemove,
    dismiss,
    restore,
    retryRemove,
    moveSongs,
    retryOrder,
    orderPlaylists,
    retryPlaylistOrder,
    flush,
    recover,
    resume,
    forget,
  }
}
