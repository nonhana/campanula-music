import type { Song } from '#lib/api/library.js'
import { creditLine } from '#lib/api/library.js'

// 界面上通用的文字：语言标记、歌手一行、首数 / 播放次数 / 时长。歌单页专属的写法在 library/view.ts，
// 歌单名字在 playlist/playlist-text.ts，播放来源名在 player/view.ts，现在这首歌在 player/now.ts

const KANA = /[\u3040-\u30FF\u31F0-\u31FF\uFF66-\uFF9F]/
/** 常见的繁体专用字，用来粗略认出繁体中文（视觉原型 data.ts 的做法） */
const TRADITIONAL = /[們個說這樣對時會從來發現與機關點經國長開門問間聽見東車為讓過還進遠運達選隨實寫學愛戲遊類歲鄧紫倫傑煉幸倔強偷頭風雲夢裡麼妳嗎號鐘覺緣戀憶漸靈雙聲歡]/

/**
 * 歌名、歌手、专辑、歌单名的 lang（DESIGN.md The Mixed Script Rule）：含假名的标 ja，繁体标 zh-TW，
 * 其余跟随页面（undefined）
 */
export const langOf = (...texts: string[]): 'ja' | 'zh-TW' | undefined => {
  const all = texts.join(' ')
  if (KANA.test(all))
    return 'ja'
  if (TRADITIONAL.test(all))
    return 'zh-TW'
  return undefined
}

/** 一首歌的歌手一行（见 creditLine） */
export const artistLine = (song: Song): string => creditLine(song.artists)

/** 专辑的发行年份（本地时区）；网易云没给时间时是 null */
export const yearOf = (publishedAt: number): number | null => publishedAt > 0
  ? new Date(publishedAt).getFullYear()
  : null

/** 首数等：千位加逗号（4,984） */
export const formatCount = (count: number): string => count.toLocaleString('en-US')

/**
 * 播放次数：一万以上按“万”写、一亿以上按“亿”写，不到一百（万、亿）留一位小数（27.3 万、1618 万、2.5 亿、253 亿），
 * 一万以下照写（9,999）。网易云自己的歌单有播放两百多亿次的（私人雷达）
 */
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

/** 时长：分:秒 */
export const formatDuration = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
