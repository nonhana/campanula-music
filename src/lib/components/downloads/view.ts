import type { Song } from '#lib/api/library.js'
import type { DownloadFailure } from '#lib/app/downloads.js'
import type { AppView } from '../app-context.svelte'
import { failureText } from '../failure'
import { songLook } from '../songs/song-look'

// 下载在“更多”菜单里怎么显示（#38，DESIGN.md Song Row · 状态、Chips · Badges）：下载那一项的文案、没下成的原因。
// 现在能不能下、为什么不能由 App 给（state.downloadBlock，和 App.download 同一份规则）；行上的状态在 songs/song-look.ts

/** “更多”菜单里下载那一项：文案，能不能点 */
export function downloadItem(view: AppView, song: Song): { label: string, disabled: boolean } {
  const block = view.state.downloadBlock(song)
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
    case 'signedOut':
      return { label: '登录后才能下载', disabled: true }
    case 'offline':
      return { label: '断网时不能下载', disabled: true }
    default: {
      const unhandled: never = block
      throw new Error(`不认识的原因：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 为什么没下成：原因短语，不带句号和下一步，拼在“没能下载《…》：”后面 */
export function downloadFailureText(failure: DownloadFailure): string {
  switch (failure.kind) {
    case 'request':
      return failureText(failure.failure)
    case 'unavailable':
      return '这个账号可能下载不了完整音频'
    case 'interrupted':
      return '连接断了'
    case 'storageFull':
      return '存储空间不够了'
    default: {
      const unhandled: never = failure
      throw new Error(`不认识的下载失败：${JSON.stringify(unhandled)}`)
    }
  }
}
