import type { Playlist, Song } from '#lib/api/library.js'

import type { Clock } from './browser'
import type { Change } from './changes'
import type { DownloadNotice } from './downloads'
import type { ChangeFailure } from './library'

// 提示条（改曲库、下载共用的那一摞，Spec #11“界面”“客户端：晚一点才提交的修改”）：App 拥有它，每条带 id、种类、载荷和它支持的动作，
// 界面只照着画。重试用的数据就在载荷里；支持哪些动作由 noticeActions 算出来，“不能重试”就是没有重试动作。
// 自动消失也在这里，走 App 的时钟：做成了的那几条 4 秒后自己走，出错的一直留着到关掉。
// 最多 3 条：满时先走最旧的可自动消失的成功提示，没有就最旧一条；同一动作 2 秒内又来一条时合并到原来那一条。

export type NoticeAction = 'undo' | 'retry' | 'dismiss' | 'resume'

/** 配 ✓ 还是配感叹号；界面照着画，不按种类猜 */
export type NoticeTone = 'success' | 'error'

/** 改曲库、下载后要告诉听众的事；下载失败也走这一条 */
export type OperationNotice
  = | { kind: 'notChanged', change: Change, failure: ChangeFailure }
    /** 歌单在网易云里已经不在了（在别处删掉了）：改回原样，马上同步一次曲库 */
    | { kind: 'playlistMissing', change: Extract<Change, { kind: 'add' | 'addMany' | 'remove' | 'order' | 'collectPlaylist' }> }
    | { kind: 'added', change: Extract<Change, { kind: 'add' | 'addMany' }> }
    | { kind: 'alreadyAdded', playlist: Playlist }
    /** 先从本地拿掉，5 秒内可以撤销；removalId 认这一批，撤销按它整批放回 */
    | { kind: 'removed', playlist: Playlist, count: number, removalId: number }
    /** 已经从本地拿掉的放回原位（断网、超过上限时根本没拿掉） */
    | { kind: 'removeFailed', playlist: Playlist, count: number, songIds: readonly number[], failure: ChangeFailure }
    /** 本地已经改回原来的顺序（断网时根本没改本地），可以重试；failure 是 null 表示网易云回 -1、重读也不是新顺序，说不出原因 */
    | { kind: 'orderFailed', playlist: Playlist, songIds: readonly number[], failure: ChangeFailure | null }
    /** 本地已经改回原来的顺序（断网时根本没改本地），可以重试 */
    | { kind: 'playlistOrderFailed', playlistIds: readonly number[], failure: ChangeFailure }
    /** 已经从网易云重拉这张歌单、恢复原样 */
    | { kind: 'recovered' }
    /** 空队列时直接开始放（started）还是排进队列；count 是 2 秒里合并的条数 */
    | { kind: 'queuedNext', count: number, started: boolean }
    | { kind: 'queuedEnd', count: number, started: boolean }
    /** 从“更多”菜单红心；行内心形不发 */
    | { kind: 'hearted', song: Song, hearted: boolean }
    | { kind: 'playlistCreated', name: string }
    | { kind: 'playlistPublished', name: string }
    | { kind: 'playlistDeleted', name: string }
    /** 纯界面事件（复制、权限这类）：业务动作由 App 发语义提示，不写在这里 */
    | { kind: 'plain', tone: NoticeTone, text: string }
    | DownloadNotice

export interface NoticeEntry {
  /** 一次 App 期间不重复：界面按它认是哪一条、按它起 view-transition-name */
  id: number
  notice: OperationNotice
  /** 界面照着画按钮，App 的动作入口照着做 */
  actions: readonly NoticeAction[]
  tone: NoticeTone
}

export interface ShowNoticeOptions {
  /** 同一个动作的提示在 2 秒内合并成一条；不给就每次都单开一条 */
  key?: string
}

const AUTO_DISMISS_MS = 4000
/** 同一动作连来两条，隔多久还算一次 */
const MERGE_WINDOW_MS = 2000
const MAX_ENTRIES = 3

/** 界面照着画按钮，App 的动作入口照着做；一次移除超过上限时重试也一样，所以没有重试 */
const noticeActions = (notice: OperationNotice): readonly NoticeAction[] => {
  switch (notice.kind) {
    case 'removed':
      return ['undo', 'dismiss']
    case 'removeFailed':
      // 一次移除超过上限：重试也一样会失败，所以没有重试动作
      return notice.failure.kind === 'invalid' && notice.failure.problem === 'tooManySongs'
        ? ['dismiss']
        : ['retry', 'dismiss']
    case 'orderFailed':
    case 'playlistOrderFailed':
      return ['retry', 'dismiss']
    case 'downloadFailed':
      // 同一窗口里合并成“N 首下载失败”以后不再给重试：逐首的重试在下载面板和已下载页
      return (notice.count ?? 1) > 1
        ? ['dismiss']
        : ['retry', 'dismiss']
    case 'downloadsPaused':
      return ['resume', 'dismiss']
    case 'downloadsRemoved':
      return ['dismiss']
    case 'notChanged':
    case 'playlistMissing':
    case 'added':
    case 'alreadyAdded':
    case 'downloadsAdded':
    case 'recovered':
    case 'queuedNext':
    case 'queuedEnd':
    case 'hearted':
    case 'playlistCreated':
    case 'playlistPublished':
    case 'playlistDeleted':
    case 'downloadQueued':
    case 'plain':
      return ['dismiss']
    default: {
      const unhandled: never = notice
      throw new Error(`不认识的提示：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 做成了的 4 秒后自己走；其余留着等听众关掉（撤销那一条由 deferred 在提交开始时收起） */
const noticeLifetime = (notice: OperationNotice): number | null => {
  switch (notice.kind) {
    case 'added':
    case 'alreadyAdded':
    case 'downloadsAdded':
    case 'downloadsRemoved':
    case 'queuedNext':
    case 'queuedEnd':
    case 'hearted':
    case 'playlistCreated':
    case 'playlistPublished':
    case 'playlistDeleted':
    case 'downloadQueued':
      return AUTO_DISMISS_MS
    case 'plain':
      return notice.tone === 'success'
        ? AUTO_DISMISS_MS
        : null
    case 'notChanged':
    case 'playlistMissing':
    case 'removed':
    case 'removeFailed':
    case 'orderFailed':
    case 'playlistOrderFailed':
    case 'recovered':
    case 'downloadFailed':
    case 'downloadsPaused':
      return null
    default: {
      const unhandled: never = notice
      throw new Error(`不认识的提示：${JSON.stringify(unhandled)}`)
    }
  }
}

const noticeTone = (notice: OperationNotice): NoticeTone => {
  switch (notice.kind) {
    case 'added':
    case 'alreadyAdded':
    case 'removed':
    case 'downloadsAdded':
    case 'downloadsRemoved':
    case 'queuedNext':
    case 'queuedEnd':
    case 'hearted':
    case 'playlistCreated':
    case 'playlistPublished':
    case 'playlistDeleted':
    case 'downloadQueued':
      return 'success'
    case 'notChanged':
    case 'playlistMissing':
    case 'removeFailed':
    case 'orderFailed':
    case 'playlistOrderFailed':
    case 'recovered':
    case 'downloadFailed':
    case 'downloadsPaused':
      return 'error'
    case 'plain':
      return notice.tone
    default: {
      const unhandled: never = notice
      throw new Error(`不认识的提示：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 没指定 key 时按种类合并：同一个动作连来几条只留一条 */
const defaultKey = (notice: OperationNotice): string | null => {
  switch (notice.kind) {
    case 'queuedNext':
      return 'queued-next'
    case 'queuedEnd':
      return 'queued-end'
    case 'downloadFailed':
      return 'download-failed'
    case 'downloadsRemoved':
      return 'downloads-removed'
    default:
      return null
  }
}

/** 合并窗口里又来一条时怎么合成：排队、失败的条数相加，别的换成新的那条 */
const mergeNotice = (previous: OperationNotice, next: OperationNotice): OperationNotice => {
  switch (next.kind) {
    case 'queuedNext':
      return previous.kind === 'queuedNext'
        ? { ...next, count: previous.count + next.count, started: previous.started }
        : next
    case 'queuedEnd':
      return previous.kind === 'queuedEnd'
        ? { ...next, count: previous.count + next.count, started: previous.started }
        : next
    case 'downloadFailed':
      return previous.kind === 'downloadFailed'
        ? { ...next, count: (previous.count ?? 1) + (next.count ?? 1) }
        : next
    case 'downloadsRemoved':
      return previous.kind === 'downloadsRemoved'
        ? {
            kind: 'downloadsRemoved',
            removed: previous.removed + next.removed,
            kept: previous.kept + next.kept,
            freed: previous.freed + next.freed,
          }
        : next
    default:
      return next
  }
}

export interface NoticesContext {
  clock: Clock
  /** 提示条变了：App 把新的那几条和各自的动作放进快照 */
  changed: () => void
}

/** 一摞提示条：新的排在最后（桌面底部、手机迷你播放条上方时离播放条最近） */
export interface Notices {
  list: () => readonly NoticeEntry[]
  /** 投递一条新的，返回它的 id */
  show: (notice: OperationNotice, options?: ShowNoticeOptions) => number
  hide: (id: number) => void
  /** 只收起符合条件的（撤消、重试这类动作要用它认出自己那一条）；返回有没有收掉 */
  hideWhere: (match: (notice: OperationNotice) => boolean) => boolean
  /** 会话换了：上一条登录的提示都不算了 */
  clear: () => void
}

interface Tracked {
  entry: NoticeEntry
  key: string | null
  /** 这一条什么时候来的；合并时重新算，窗口从这里量 */
  at: number
  cancel: () => void
}

export const createNotices = ({ clock, changed }: NoticesContext): Notices => {
  let entries: Tracked[] = []
  let nextId = 1

  const drop = (tracked: Tracked): void => {
    tracked.cancel()
    entries = entries.filter(each => each !== tracked)
  }

  const schedule = (tracked: Tracked): void => {
    const lifetime = noticeLifetime(tracked.entry.notice)
    if (lifetime === null)
      return
    tracked.cancel = clock.after(lifetime, () => {
      tracked.cancel = () => {}
      if (!entries.includes(tracked))
        return
      drop(tracked)
      changed()
    })
  }

  /** 同一个动作在 2 秒里又来一条：留在原来那一行，换成新的内容（条数怎么加在各自的种类里） */
  const mergeInto = (tracked: Tracked, notice: OperationNotice): void => {
    tracked.cancel()
    tracked.entry = {
      id: tracked.entry.id,
      notice,
      actions: noticeActions(notice),
      tone: noticeTone(notice),
    }
    tracked.at = clock.now()
    schedule(tracked)
  }

  const show = (notice: OperationNotice, options: ShowNoticeOptions = {}): number => {
    const key = options.key ?? defaultKey(notice)
    if (key !== null) {
      const found = entries.find(tracked => tracked.key === key && clock.now() - tracked.at <= MERGE_WINDOW_MS)
      if (found) {
        mergeInto(found, mergeNotice(found.entry.notice, notice))
        changed()
        return found.entry.id
      }
    }
    while (entries.length >= MAX_ENTRIES) {
      // 满时先走最旧的可自动消失的成功提示，没有就最旧一条
      const at = entries.findIndex(tracked => noticeLifetime(tracked.entry.notice) !== null)
      const oldest = entries[at >= 0
        ? at
        : 0]
      if (!oldest)
        break
      drop(oldest)
    }
    const entry: NoticeEntry = {
      id: nextId++,
      notice,
      actions: noticeActions(notice),
      tone: noticeTone(notice),
    }
    const tracked: Tracked = {
      entry,
      key,
      at: clock.now(),
      cancel: () => {},
    }
    entries = [...entries, tracked]
    schedule(tracked)
    changed()
    return entry.id
  }

  const hide = (id: number): void => {
    const tracked = entries.find(each => each.entry.id === id)
    if (!tracked)
      return
    drop(tracked)
    changed()
  }

  const hideWhere = (match: (notice: OperationNotice) => boolean): boolean => {
    const matched = entries.filter(tracked => match(tracked.entry.notice))
    if (matched.length === 0)
      return false
    for (const tracked of matched)
      drop(tracked)
    changed()
    return true
  }

  const clear = (): void => {
    if (entries.length === 0)
      return
    for (const tracked of entries)
      tracked.cancel()
    entries = []
    changed()
  }

  return {
    list: () => entries.map(tracked => tracked.entry),
    show,
    hide,
    hideWhere,
    clear,
  }
}
