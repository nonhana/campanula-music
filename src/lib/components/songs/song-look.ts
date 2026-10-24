import type { Song } from '#lib/api/library.js'

import type { AppView } from '../shared/app-context.svelte'

// 歌曲行上的状态（DESIGN.md Song Row · 状态、Chips · Badges）：能不能点、歌名后面的徽标、下载标记。
// 规则只在 App 里推一次：现在能不能放读 state.playable（下载了的总能放，ADR-0006；没下载的要能在线放，无版权不能放）

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

/** 一首歌在列表里现在是什么样子：能不能放由 App 给，下载标记和徽标照着画 */
export const songLook = (view: AppView, song: Song): SongLook => {
  const { downloads } = view.state
  const downloaded = downloads.has(song.id)
  const task = downloads.tasks.get(song.id)
  const mark: DownloadMark | null = downloaded
    ? { kind: 'done' }
    : task?.status === 'downloading'
      ? {
          kind: 'downloading',
          percent: task.total
            ? Math.floor(task.received * 100 / task.total)
            : 0,
        }
      : task?.status === 'failed'
        ? { kind: 'failed' }
        : null
  const off = !view.state.playable(song)
  // 徽标：无版权优先；下载了的放本机的完整音频，不标试听
  const badge: SongBadgeKind | null = downloaded
    ? null
    : song.availability === 'noCopyright'
      ? 'noCopyright'
      : off
        ? 'notDownloaded'
        : song.availability === 'trial'
          ? 'trial'
          : null
  return { off, badge, mark }
}
