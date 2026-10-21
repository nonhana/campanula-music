import type { Song } from '#lib/api/library.js'
import type { DownloadBlock, DownloadFailure } from '#lib/app/downloads.js'
import type { AppView } from '../app-context.svelte'
import { downloadBlock } from '#lib/app/downloads.js'
import { failureText } from '../failure'

// 下载在界面上怎么显示（#38，DESIGN.md Song Row · 状态、Chips · Badges）：歌曲行的状态、徽标、“更多”菜单里下载那一项的文案，
// 没下成的原因。规则和 App 的一样：下载了的歌永久可播（ADR-0006）；没下载的要能在线放（联网、登录着），无版权的不能放

/** 歌曲行上的下载标记：已下载（蜜桃枝图标）、下载中（蜜桃进度）、下载失败（出错红） */
export type DownloadMark
  = | { kind: 'done' }
    | { kind: 'downloading', percent: number }
    | { kind: 'failed' }

/** 跟在歌名后面的徽标：无版权、断网时没下载、只能试听。按这个先后只显示一个；下载了的歌放本机的完整音频，不显示 */
export type SongBadgeKind = 'noCopyright' | 'notDownloaded' | 'trial'

export interface SongLook {
  /** 现在放不了：整行降到 45%、不能点（••• 照样能点） */
  off: boolean
  badge: SongBadgeKind | null
  mark: DownloadMark | null
}

/** 现在能不能在线放：联网着、登录着。不能时只有下载了的歌能放 */
export function streamable(view: AppView): boolean {
  return view.state.online && view.state.session.status === 'signedIn'
}

/** 一首歌在列表里现在是什么样子 */
export function songLook(view: AppView, song: Song): SongLook {
  const { downloads } = view.state
  const downloaded = downloads.has(song.id)
  const online = streamable(view)
  const task = downloads.tasks.get(song.id)
  const mark: DownloadMark | null = downloaded
    ? { kind: 'done' }
    : task?.status === 'downloading'
      ? { kind: 'downloading', percent: task.total ? Math.floor(task.received * 100 / task.total) : 0 }
      : task?.status === 'failed' ? { kind: 'failed' } : null
  if (downloaded)
    return { off: false, badge: null, mark }
  if (song.availability === 'noCopyright')
    return { off: true, badge: 'noCopyright', mark }
  if (!online)
    return { off: true, badge: 'notDownloaded', mark }
  return { off: false, badge: song.availability === 'trial' ? 'trial' : null, mark }
}

/** “更多”菜单里下载那一项：文案，能不能点 */
export function downloadItem(view: AppView, song: Song): { label: string, disabled: boolean } {
  const block: DownloadBlock | null = downloadBlock(song, view.state.downloads, view.state.online)
  switch (block) {
    case null:
      return { label: view.state.downloads.tasks.get(song.id)?.status === 'failed' ? '重新下载' : '下载', disabled: false }
    case 'downloaded':
      return { label: '已下载', disabled: true }
    case 'downloading': {
      const look = songLook(view, song).mark
      return { label: look?.kind === 'downloading' ? `正在下载 ${look.percent}%` : '正在下载', disabled: true }
    }
    case 'trial':
      return { label: '试听歌曲不能下载', disabled: true }
    case 'noCopyright':
      return { label: '无版权，不能下载', disabled: true }
    case 'offline':
      return { label: '断网时不能下载', disabled: true }
    default: {
      const unhandled: never = block
      throw new Error(`不认识的原因：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 为什么没下成、能怎么办 */
export function downloadFailureText(failure: DownloadFailure): string {
  switch (failure.kind) {
    case 'request':
      return failureText(failure.failure)
    case 'unavailable':
      return '网易云没有给这首歌的下载地址：这个账号可能下载不了完整的音频。'
    case 'interrupted':
      return '没下完，网络断了或者网易云的服务器断开了。点“重试”从头再下。'
    case 'storageFull':
      return '这台设备的存储空间不够了，腾出一些空间再试。'
    default: {
      const unhandled: never = failure
      throw new Error(`不认识的下载失败：${JSON.stringify(unhandled)}`)
    }
  }
}
