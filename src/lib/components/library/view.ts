import { playlistName } from '#lib/api/library.js'
import type { PlaylistPage } from '#lib/app/library.js'

import { formatCount, formatPlays } from '../shared/text'

// 歌单页专属的写法：头部资料按界面排好；哪些歌、失败显示在哪、能做什么都在 App 的答案里（library.playlistPage）。封面飞行尺寸在 flight.ts（#75）。

export interface PlaylistHeader {
  name: string
  /** 网易云没给封面时是 null，显示默认封面 */
  coverUrl: string | null
  /** 创建者；不写类别（方封面和旁边的按钮已经说明是歌单）。网易云没给的不写（#78） */
  creator: string | null
  /** 创建者头像；没有用户页，只显示，不链接 */
  creatorAvatarUrl: string | null
  /** 首数、播放次数，和创建者之间用 · 隔开；网易云没给的不写（#78） */
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
    ? null
    : page.songs.kind === 'songs' && !page.songs.complete
      ? `${formatCount(page.count.loaded)} / ${formatCount(page.count.total)} 首`
      : `${formatCount(page.count.total)} 首`
  const plays = info.playCount !== null && info.playCount > 0
    ? `播放 ${formatPlays(info.playCount)}`
    : null
  return {
    name: playlistName({ name: info.name, kind: page.kind }),
    coverUrl: info.coverUrl,
    creator: info.creator,
    creatorAvatarUrl: info.creatorAvatarUrl,
    meta: [count, plays].filter((part): part is string => Boolean(part)),
    private: page.private,
    description: info.description?.trim() || null,
    tags: info.tags,
  }
}
