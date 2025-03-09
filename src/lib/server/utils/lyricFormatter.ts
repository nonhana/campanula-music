import type { LyricItem } from '$lib/types'

/**
 * 将时间字符串转换为毫秒
 * @param timeStr 时间字符串，格式为[mm:ss.xx]
 * @returns 毫秒数
 */
function timeStrToMs(timeStr: string): number {
  // 匹配[mm:ss.xx]格式的时间戳
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/
  const match = timeRegex.exec(timeStr)

  if (!match)
    return 0

  const minutes = Number.parseInt(match[1], 10)
  const seconds = Number.parseInt(match[2], 10)
  const milliseconds
    = match[3].length === 2
      ? Number.parseInt(match[3], 10) * 10 // 如果是两位小数，乘以10
      : Number.parseInt(match[3], 10) // 如果是三位小数，直接使用

  return minutes * 60 * 1000 + seconds * 1000 + milliseconds
}

/**
 * 解析歌词字符串，提取时间戳和文本
 * @param lyricStr 歌词字符串
 * @returns 时间戳和文本的映射
 */
function parseLyric(lyricStr: string): Map<number, string> {
  if (!lyricStr)
    return new Map()

  const lines = lyricStr.split('\n')
  const result = new Map<number, string>()

  for (const line of lines) {
    // 匹配时间戳 [00:00.00]
    const timeRegex = /^\[(\d{2}:\d{2}\.\d{2,3})\]/
    const match = timeRegex.exec(line)

    if (match) {
      const timeStr = match[0]
      const time = timeStrToMs(timeStr)
      const text = line.replace(timeRegex, '').trim()

      // 只保存有内容的歌词
      if (text) {
        result.set(time, text)
      }
    }
  }

  return result
}

/**
 * 格式化歌词，将原始歌词和翻译整合成统一格式
 * @param lyric 原始歌词字符串
 * @param translatedLyric 翻译歌词字符串
 * @returns 格式化后的歌词数组
 */
export function lyricFormatter(lyric: string, translatedLyric: string | null): LyricItem[] {
  if (!lyric)
    return []

  // 解析原歌词和翻译歌词
  const lyricMap = parseLyric(lyric)
  const translatedLyricMap = translatedLyric
    ? parseLyric(translatedLyric)
    : new Map<number, string>()

  // 合并所有时间点，确保不会漏掉任何一条歌词
  const allTimes = new Set([...lyricMap.keys(), ...translatedLyricMap.keys()])
  const result: LyricItem[] = []

  // 按时间排序
  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b)

  for (const time of sortedTimes) {
    const text = lyricMap.get(time) || ''

    // 只有当原文歌词存在时才添加到结果中
    if (text) {
      result.push({
        time,
        text,
        translate: translatedLyricMap.get(time) || null,
      })
    }
  }

  return result
}
