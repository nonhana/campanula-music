import type { Playlist } from '#lib/api/library.js'

import type { Clock } from './browser'
import type { Change } from './changes'
import type { DownloadNotice } from './downloads'
import type { ChangeFailure } from './library'

// 提示条（改曲库、下载共用的那一条，Spec #11“界面”“客户端：晚一点才提交的修改”）：App 拥有它，带种类、载荷和它支持的动作，
// 界面只照着画。重试用的数据就在载荷里；支持哪些动作由 noticeActions 算出来，“不能重试”就是没有重试动作。
// 自动消失也在这里，走 App 的时钟：加入歌单成功 4 秒后自己走，换了一条就重新计时。

export type NoticeAction = 'undo' | 'retry' | 'dismiss' | 'resume'

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
    | DownloadNotice

const AUTO_DISMISS_MS = 4000

/** 界面照着画按钮，App 的动作入口照着做；一次移除超过上限时重试也一样，所以没有重试 */
export const noticeActions = (notice: OperationNotice): readonly NoticeAction[] => {
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
    case 'downloadFailed':
      return ['retry', 'dismiss']
    case 'downloadsPaused':
      return ['resume', 'dismiss']
    case 'notChanged':
    case 'playlistMissing':
    case 'added':
    case 'alreadyAdded':
    case 'downloadsAdded':
    case 'recovered':
      return ['dismiss']
    default: {
      const unhandled: never = notice
      throw new Error(`不认识的提示：${JSON.stringify(unhandled)}`)
    }
  }
}

export interface NoticesContext {
  clock: Clock
  /** 提示条换了：App 把新的提示条和动作放进曲库快照 */
  changed: () => void
}

/** 当前这一条；投递一条新的（null 是关闭） */
export interface Notices {
  current: () => OperationNotice | null
  show: (notice: OperationNotice | null) => void
}

export const createNotices = ({ clock, changed }: NoticesContext): Notices => {
  let current: OperationNotice | null = null
  /** 这一条自动消失的计时 */
  let cancel = () => {}

  const show = (next: OperationNotice | null): void => {
    if (next === current)
      return
    cancel()
    cancel = () => {}
    current = next
    if (next?.kind === 'added' || next?.kind === 'alreadyAdded' || next?.kind === 'downloadsAdded') {
      cancel = clock.after(AUTO_DISMISS_MS, () => {
        cancel = () => {}
        if (current !== next)
          return
        current = null
        changed()
      })
    }
    changed()
  }

  return {
    current: () => current,
    show,
  }
}
