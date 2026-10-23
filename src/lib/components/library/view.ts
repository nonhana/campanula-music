import type { Playlist, Song } from '#lib/api/library.js'
import type { PlaylistPage } from '#lib/app/library.js'
import type { ScrollMark } from '../ui/scroll-marks'
import { creditLine } from '#lib/api/library.js'

// 曲库界面上的措辞和格式化：歌单页头部写什么、歌单名字怎么叫、首数 / 播放次数 / 时长怎么排。
// 哪些歌、失败显示在哪、能做什么，都在 App 的答案里（library.playlistPage）

/** 歌单页的头部：把答案里的资料按界面的写法排好 */
export interface PlaylistHeader {
  name: string
  coverUrl: string
  /** 名字下面的一行：创建者、首数、播放次数（不写类别：方封面和旁边的按钮已经说明是歌单） */
  meta: string[]
  private: boolean
  /** 简介：没写（或只有空白）时是 null */
  description: string | null
  tags: readonly string[]
}

/**
 * 歌单页的头部；答案里还没有歌单资料时是 null。
 * 首数和下面的列表对得上（DESIGN.md Do's）：有全了是实际有的歌，还在拉时写“拉到了几首 / 一共几首”，列表还没出来时不写。
 * 播放次数是 0 时不写：新歌单，或者刚从旧版本升上来、还没同步到真的值
 */
export function playlistHeader(page: PlaylistPage): PlaylistHeader | null {
  const info = page.info
  if (!info)
    return null
  const count = page.count === null
    ? ''
    : page.songs.kind === 'songs' && !page.songs.complete ? `${formatCount(page.count.loaded)} / ${formatCount(page.count.total)} 首` : `${formatCount(page.count.total)} 首`
  const plays = info.playCount > 0 ? `播放 ${formatPlays(info.playCount)}` : ''
  return {
    name: page.kind === 'liked' ? '我喜欢的音乐' : info.name,
    coverUrl: info.coverUrl,
    meta: [info.creator, count, plays].filter(Boolean),
    private: page.private,
    description: info.description?.trim() || null,
    tags: info.tags,
  }
}

/** 歌单的名字：我喜欢的音乐在网易云里叫“某某喜欢的音乐”，界面上统一叫我喜欢的音乐 */
export function playlistName(playlist: Playlist): string {
  return playlist.kind === 'liked' ? '我喜欢的音乐' : playlist.name
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

/**
 * 播放次数：一万以上按“万”写、一亿以上按“亿”写，不到一百（万、亿）留一位小数（27.3 万、1618 万、2.5 亿、253 亿），
 * 一万以下照写（9,999）。网易云自己的歌单有播放两百多亿次的（私人雷达）
 */
export function formatPlays(count: number): string {
  if (count < 10_000)
    return formatCount(count)
  const [unit, label] = count < 100_000_000 ? [10_000, '万'] : [100_000_000, '亿']
  const value = count / unit
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${label}`
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
