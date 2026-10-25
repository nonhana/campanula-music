import type { Song } from '#lib/api/library.js'
import type { DownloadFailure, DownloadsState } from '#lib/app/downloads.js'
import type { ExportFailure } from '#lib/app/export.js'
import type { DownloadSource } from '#lib/app/local.js'

import type { AppView } from '../shared/app-context.svelte'
import { failureText } from '../shared/failure'
import { songLook } from '../songs/song-look'

// 下载在“更多”菜单里怎么显示（#38）：现在能不能下、为什么不能由 App 给（state.downloadBlock，和 App.download 同一份规则）。

export const downloadItem = (view: AppView, song: Song): { label: string, disabled: boolean } => {
  const block = view.state.downloadBlock(song)
  switch (block) {
    case null:
      return {
        label: view.state.downloads.tasks.get(song.id)?.status === 'failed'
          ? '重新下载'
          : '下载',
        disabled: false,
      }
    case 'downloaded':
      return { label: '已下载', disabled: true }
    case 'queued':
      return { label: '排队中', disabled: true }
    case 'downloading': {
      const look = songLook(view, song).mark
      return {
        label: look?.kind === 'downloading' && look.percent !== null
          ? `正在下载 ${look.percent}%`
          : '正在下载',
        disabled: true,
      }
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

/** 原因短语，不带句号和下一步，拼在“没能下载《…》：”后面 */
export const downloadFailureText = (failure: DownloadFailure): string => {
  switch (failure.kind) {
    case 'request':
      return failureText(failure.failure)
    case 'unavailable':
      return '这个账号下不了完整的音频'
    case 'interrupted':
      return '连接断了'
    case 'saveFailed':
      return '存储时出错'
    case 'appError':
      return 'Campanula 出错了'
    default: {
      const unhandled: never = failure
      throw new Error(`不认识的下载失败：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 一首没导出的原因（#79）：短语，不带句号和下一步，拼在“《…》：”后面 */
export const exportFailureText = (failure: ExportFailure): string => {
  switch (failure.kind) {
    case 'storageFull':
      return '空间不够'
    case 'notAllowed':
      return '文件夹不让写'
    case 'failed':
      return '写入时出错'
    default: {
      const unhandled: never = failure
      throw new Error(`不认识的导出失败：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 从哪张歌单下载过、各有几首（#40 设置页的按歌单删除）：只看下载里记着的来源，没登录时也有 */
export interface PlaylistDownloadSource {
  id: number
  name: string
  count: number
}

export const playlistDownloadSources = (downloads: DownloadsState): PlaylistDownloadSource[] => {
  const found = new Map<number, PlaylistDownloadSource>()
  const add = (sources: readonly DownloadSource[]): void => {
    for (const source of sources) {
      if (source.kind !== 'playlist')
        continue
      const existing = found.get(source.id)
      if (existing)
        existing.count += 1
      else
        found.set(source.id, { id: source.id, name: source.name, count: 1 })
    }
  }
  for (const song of downloads.songs ?? [])
    add(downloads.sourcesOf(song.id))
  // 排队中、下载中的也算：按歌单删除时它们会和已下载的歌一起停掉
  for (const task of downloads.tasks.values())
    add(task.sources)
  return [
    ...found.values(),
  ].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}
