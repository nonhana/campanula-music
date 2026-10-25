import type { Song } from '#lib/api/library.js'
import { creditLine } from '#lib/api/library.js'

// 界面上通用的文字：语言标记、歌手一行、首数 / 播放次数 / 时长。歌单页专属的写法在 library/view.ts，
// 歌单名字在 playlist/playlist-text.ts，播放来源名在 player/view.ts，现在这首歌在 player/now.ts

const KANA = /[\u3040-\u30FF\u31F0-\u31FF\uFF66-\uFF9F]/
/** 用来粗略认出繁体中文（视觉原型 data.ts 的做法） */
const TRADITIONAL = /[們個說這樣對時會從來發現與機關點經國長開門問間聽見東車為讓過還進遠運達選隨實寫學愛戲遊類歲鄧紫倫傑煉幸倔強偷頭風雲夢裡麼妳嗎號鐘覺緣戀憶漸靈雙聲歡]/

/** lang（DESIGN.md The Mixed Script Rule）：含假名的标 ja，繁体标 zh-TW，其余跟随页面；网易云没给的文字（null）不算 */
export const langOf = (...texts: (string | null)[]): 'ja' | 'zh-TW' | undefined => {
  const all = texts.filter(text => text !== null).join(' ')
  if (KANA.test(all))
    return 'ja'
  if (TRADITIONAL.test(all))
    return 'zh-TW'
  return undefined
}

export const artistLine = (song: Song): string => creditLine(song.artists)

/** 本地时区；网易云没给时间时是 null */
export const yearOf = (publishedAt: number | null): number | null => publishedAt !== null && publishedAt > 0
  ? new Date(publishedAt).getFullYear()
  : null

export const formatCount = (count: number): string => count.toLocaleString('en-US')

/** “N 首”；网易云没给首数时是 null，这一项不显示（#78） */
export const formatSongCount = (count: number | null): string | null => count === null
  ? null
  : `${formatCount(count)} 首`

/** 一万以上按“万”、一亿以上按“亿”，不到一百（万、亿）留一位小数（27.3 万、2.5 亿），一万以下照写；网易云自己有播放两百多亿次的歌单 */
export const formatPlays = (count: number): string => {
  if (count < 10_000)
    return formatCount(count)
  const [unit, label] = count < 100_000_000
    ? [10_000, '万']
    : [100_000_000, '亿']
  const value = count / unit
  return `${value.toFixed(value >= 100
    ? 0
    : 1)} ${label}`
}

export const formatDuration = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** 字节数按 MB 写，一位小数（导出时写明多大、写到哪儿，#79）；不带单位，单位由调用处写一次（“3.2/9.8 MB”） */
export const formatMegabytes = (bytes: number): string => (bytes / 1024 / 1024).toFixed(1)
