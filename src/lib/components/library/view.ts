import type { PlaylistPage } from '#lib/app/library.js'

import { formatCount, formatPlays } from '../shared/text'

// 歌单页专属的写法：头部资料按界面排好；哪些歌、失败显示在哪、能做什么都在 App 的答案里（library.playlistPage）。封面飞行尺寸在 flight.ts（#75）。

export interface PlaylistHeader {
  name: string
  coverUrl: string
  /** 创建者、首数、播放次数；不写类别（方封面和旁边的按钮已经说明是歌单） */
  meta: string[]
  private: boolean
  /** 没写（或只有空白）时是 null */
  description: string | null
  tags: readonly string[]
}

/** 答案里还没有资料时是 null。首数和下面的列表对得上（DESIGN.md Do's）；播放次数是 0 时不写（新歌单或还没同步到真的值） */
export const playlistHeader = (page: PlaylistPage): PlaylistHeader | null => {
  const info = page.info
  if (!info)
    return null
  const count = page.count === null
    ? ''
    : page.songs.kind === 'songs' && !page.songs.complete
      ? `${formatCount(page.count.loaded)} / ${formatCount(page.count.total)} 首`
      : `${formatCount(page.count.total)} 首`
  const plays = info.playCount > 0
    ? `播放 ${formatPlays(info.playCount)}`
    : ''
  return {
    name: page.kind === 'liked'
      ? '我喜欢的音乐'
      : info.name,
    coverUrl: info.coverUrl,
    meta: [info.creator, count, plays].filter(Boolean),
    private: page.private,
    description: info.description?.trim() || null,
    tags: info.tags,
  }
}
