import type { Credit, Playlist, Song } from '#lib/api/library.js'
import type { RequestFailure } from '#lib/app/api.js'
import type { LibraryState, PlaylistSongs, SyncFailure } from '#lib/app/library.js'
import type { ScrollMark } from '../ui/scroll-marks'
import { failureText } from '../failure'

// 曲库界面上怎么显示：同步条说什么、歌单是加载中、空、出错还是列表。界面组件只照着画

/** 一张歌单（包括我喜欢的音乐）的歌曲列表那一块显示什么 */
export type SongsView
  /** 还没拿到歌：骨架行 */
  = | { kind: 'loading' }
  /** 同步完了，一首都没有 */
    | { kind: 'empty' }
  /** 一首都还没拿到就没拉成：说明原因，可以重试 */
    | { kind: 'failed', failure: RequestFailure }
  /** total：一共几首。还在同步时比 songs 多；同步完了就是 songs 的首数（网易云没给的歌不算），和列表对得上 */
    | { kind: 'songs', songs: readonly Song[], total: number, complete: boolean }

function songsView(playlist: PlaylistSongs, failure: RequestFailure | null): SongsView {
  if (playlist.songs.length > 0)
    return { kind: 'songs', songs: playlist.songs, total: playlist.complete ? playlist.songs.length : playlist.total, complete: playlist.complete }
  if (playlist.complete)
    return { kind: 'empty' }
  return failure ? { kind: 'failed', failure } : { kind: 'loading' }
}

export function likedView(library: LibraryState): SongsView {
  const { liked, sync } = library
  const failure = sync.status === 'failed' ? sync.failure : null
  if (!liked)
    return failure ? { kind: 'failed', failure } : { kind: 'loading' }
  return songsView(liked, failure)
}

/** 歌单页：歌单列表里没有这张歌单（在网易云里删掉了、地址不对）时是 missing */
export type PlaylistView = SongsView | { kind: 'missing' }

export function playlistView(library: LibraryState, playlistId: number): PlaylistView {
  const { sync } = library
  const syncFailure = sync.status === 'failed' ? sync.failure : null
  if (!library.playlists)
    return syncFailure ? { kind: 'failed', failure: syncFailure } : { kind: 'loading' }
  const playlist = library.songsOf(playlistId)
  if (!playlist)
    return { kind: 'missing' }
  // 打开时拉过：以它为准；没拉过（还没到能拉的时候）才看后台同步
  const opening = library.opening.get(playlistId)
  return songsView(playlist, opening ? (opening.status === 'failed' ? opening.failure : null) : syncFailure)
}

/** 歌单的名字：我喜欢的音乐在网易云里叫“某某喜欢的音乐”，界面上统一叫我喜欢的音乐 */
export function playlistName(playlist: Playlist): string {
  return playlist.kind === 'liked' ? '我喜欢的音乐' : playlist.name
}

export type PlaylistFilter = 'all' | 'own' | 'collected'

export const PLAYLIST_FILTERS: readonly { key: PlaylistFilter, label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'own', label: '自建' },
  { key: 'collected', label: '收藏' },
]

/** 歌单标签、首页的歌单网格：我喜欢的音乐另有一块，不在里面 */
export function filterPlaylists(playlists: readonly Playlist[], filter: PlaylistFilter): Playlist[] {
  return playlists.filter(playlist => playlist.kind !== 'liked' && (filter === 'all' || playlist.kind === filter))
}

/** 首次同步的进度：整个曲库同步完了几张歌单、几首歌 */
export interface SyncProgress {
  playlists: { done: number, total: number }
  songs: { done: number, total: number }
}

/**
 * 同步条：首次同步（还有歌单一首都没同步到，或者我喜欢的音乐还没同步全）或同步出错时才显示；
 * 曲库已经在本机、只是在后台比对时不打扰。
 * failureShown：这一页别的地方已经说了同步为什么没成功（一首歌都没有时的出错状态），同步条不再重复
 */
export type SyncNotice
  /** 还不知道曲库有多大（歌单列表还没拿到）时 progress 是 null */
  = | { kind: 'syncing', progress: SyncProgress | null }
  /** 网易云说操作频繁：过一会儿自动接着同步 */
    | { kind: 'rateLimited' }
  /** 断网：联网后接着同步 */
    | { kind: 'offline' }
  /** 停下了：text 说明原因，可以重试 */
    | { kind: 'failed', text: string }

export function syncNotice(library: LibraryState, failureShown = false): SyncNotice | null {
  const { sync } = library
  if (sync.status === 'failed')
    return failureShown ? null : { kind: 'failed', text: syncFailureText(sync.failure) }
  if (sync.status === 'synced')
    return null
  const playlists = library.playlists?.map(playlist => library.songsOf(playlist.id)!) ?? null
  const firstSync = !playlists || playlists.some(({ playlist, songs, complete }) => !complete && (songs.length === 0 || playlist.kind === 'liked'))
  if (!firstSync)
    return null
  switch (sync.status) {
    case 'syncing':
      return {
        kind: 'syncing',
        progress: playlists && {
          playlists: { done: playlists.filter(playlist => playlist.complete).length, total: playlists.length },
          // 同步完的歌单按一共几首算：网易云没给的歌（下架了）不会再有，进度要能走到头
          songs: playlists.reduce((sum, { songs, total, complete }) => ({ done: sum.done + (complete ? total : songs.length), total: sum.total + total }), { done: 0, total: 0 }),
        },
      }
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

/** 网易云图片的缩略图：地址加 ?param=宽y宽（原图不是正方形时网易云裁成正方形），换成 https（图片服务器支持，页面是 https 的） */
export function thumbnailUrl(url: string, pixels: number): string {
  return `${url.replace(/^http:/, 'https:')}?param=${pixels}y${pixels}`
}

/**
 * 歌单、专辑、歌手的格子（包括桌面歌单页的左栏）和它们页头的大封面都按这个尺寸（px）取缩略图：两头是同一个地址，
 * 从格子飞到页头时终点的图已经在缓存里，不会落在空的薄荷底上（ADR-0011）。
 * 页头比它小的（手机 168px）写成 fluid 再限宽，仍取这一张
 */
export const FLIGHT_COVER_SIZE = 200

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
export function creditLine(credits: readonly Credit[]): string {
  const names = credits.flatMap(artist => artist.name ?? [])
  return names.length > 0 ? names.join(' / ') : '未知歌手'
}

/** 一首歌的歌手一行（见 creditLine） */
export function artistLine(song: Song): string {
  return creditLine(song.artists)
}

/** 专辑的发行年份（本地时区）；网易云没给时间时是 null */
export function yearOf(publishedAt: number): number | null {
  return publishedAt > 0 ? new Date(publishedAt).getFullYear() : null
}

/** 首数等：千位加逗号（4,984） */
export function formatCount(count: number): string {
  return count.toLocaleString('en-US')
}

/** 歌曲列表里的一首在滚动条气泡里怎么写：第几首、歌名 */
export function songMark(song: Song, index: number): ScrollMark {
  return { caption: `第 ${formatCount(index + 1)} 首`, title: song.name, lang: langOf(song.name) }
}

/** 时长：分:秒 */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
