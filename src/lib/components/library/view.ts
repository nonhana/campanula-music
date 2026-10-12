import type { Song } from '$lib/api/library'
import type { LibraryState, SyncFailure } from '$lib/app/library'
import { failureText } from '../failure'

// 曲库界面上怎么显示：同步条说什么、我喜欢的音乐是加载中、空、出错还是列表。界面组件只照着画

/** 我喜欢的音乐那一块显示什么 */
export type LikedView
  /** 首次同步还没拿到歌：骨架行 */
  = | { kind: 'loading' }
  /** 同步完了，一首都没有 */
    | { kind: 'empty' }
  /** 一首都还没拿到就没同步成：说明原因，可以重试 */
    | { kind: 'failed', failure: SyncFailure }
  /** total：一共几首。还在同步时比 songs 多；同步完了就是 songs 的首数（网易云没给的歌不算），和列表对得上 */
    | { kind: 'songs', songs: readonly Song[], total: number }

export function likedView(library: LibraryState): LikedView {
  const { liked, sync } = library
  if (liked && liked.songs.length > 0)
    return { kind: 'songs', songs: liked.songs, total: liked.complete ? liked.songs.length : liked.total }
  if (liked?.complete)
    return { kind: 'empty' }
  if (sync.status === 'failed')
    return { kind: 'failed', failure: sync.failure }
  return { kind: 'loading' }
}

/**
 * 同步条：首次同步（我喜欢的音乐还没同步全）或同步出错时才显示；曲库已经在本机、只是在后台比对时不打扰。
 * 一首歌都还没有就出错时，由我喜欢的音乐那一块说明（likedView 的 failed），同步条不再重复
 */
export type SyncNotice
  /** done / total：我喜欢的音乐同步了几首、一共几首；还不知道一共几首时是 null */
  = | { kind: 'syncing', progress: { done: number, total: number } | null }
  /** 网易云说操作频繁：过一会儿自动接着同步 */
    | { kind: 'rateLimited' }
  /** 断网：联网后接着同步 */
    | { kind: 'offline' }
  /** 停下了：text 说明原因，可以重试 */
    | { kind: 'failed', text: string }

export function syncNotice(library: LibraryState): SyncNotice | null {
  const { liked, sync } = library
  if (sync.status === 'failed')
    return liked && liked.songs.length > 0 ? { kind: 'failed', text: syncFailureText(sync.failure) } : null
  const complete = liked?.complete ?? false
  if (sync.status === 'synced' || complete)
    return null
  switch (sync.status) {
    case 'syncing':
      return { kind: 'syncing', progress: liked && { done: liked.songs.length, total: liked.total } }
    case 'rateLimited':
      return { kind: 'rateLimited' }
    case 'offline':
      return { kind: 'offline' }
    default: {
      const unhandled: never = sync
      throw new Error(`不认识的同步状态：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 同步没成功的原因：已经同步的部分照常显示，所以只说哪里出了问题、重试就好 */
export function syncFailureText(failure: SyncFailure): string {
  return `曲库没能同步完。${failureText(failure)}`
}

const KANA = /[\u3040-\u30FF\u31F0-\u31FF\uFF66-\uFF9F]/
/** 常见的繁体专用字，用来粗略认出繁体中文（视觉原型 data.ts 的做法） */
const TRADITIONAL = /[們個說這樣對時會從來發現與機關點經國長開門問間聽見東車為讓過還進遠運達選隨實寫學愛戲遊類歲鄧紫倫傑煉幸倔強偷頭風雲夢裡麼妳嗎號鐘覺緣戀憶漸靈雙聲歡]/

/**
 * 歌名、歌手、专辑、歌单名的 lang（DESIGN.md The Mixed Script Rule）：含假名的标 ja，繁体标 zh-TW，
 * 其余跟随页面（undefined）
 */
export function langOf(...texts: string[]): 'ja' | 'zh-TW' | undefined {
  const all = texts.join(' ')
  if (KANA.test(all))
    return 'ja'
  if (TRADITIONAL.test(all))
    return 'zh-TW'
  return undefined
}

/** 歌手一行：没有名字的歌手（传到云盘、没匹配上曲库的歌）不列；一个都没有时写“未知歌手” */
export function artistLine(song: Song): string {
  const names = song.artists.flatMap(artist => artist.name ?? [])
  return names.length > 0 ? names.join(' / ') : '未知歌手'
}

/** 首数等：千位加逗号（4,984） */
export function formatCount(count: number): string {
  return count.toLocaleString('en-US')
}

/** 时长：分:秒 */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
