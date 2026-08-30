import type { LyricItem } from '$lib/types'
import type { NcmCallContext } from './types'
/**
 * 网易云歌词门面实现。
 *
 * 实现 NcmProvider.lyric（见 ./types）：调用 hana-music-api 的 lyric，
 * 解析 LRC 文本为领域形状 LyricItem[]（时间对齐、翻译并入 translate），
 * 纯音乐/未收录/无版权等限制如实映射，不伪造歌词。
 * 失败统一映射为 NcmError（见 ./errors）。
 */
import { lyric as sdkLyric } from 'hana-music-api'
import { mapNcmError } from './errors'
import { asRecord, assertOkBody, asString, sdkConfig } from './raw'

/** LRC 时间戳：mm:ss / mm:ss.xx（小数 1–3 位） */
const LRC_TIME_PATTERN = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

/**
 * 解析 LRC 文本为歌词条目（纯函数，便于单测）。
 * 时间戳换算毫秒并按时间升序排列（供播放进度按时间区间对齐查找）；
 * 无时间戳的元数据行与空内容行跳过；同一行多个时间戳展开为多条。
 */
export function parseLrc(text: string): LyricItem[] {
  const items: LyricItem[] = []

  for (const line of text.split(/\r?\n/)) {
    const times: number[] = []
    for (const match of line.matchAll(LRC_TIME_PATTERN)) {
      const minutes = Number(match[1])
      const seconds = Number(match[2])
      // 小数位 1 位按十分之一秒、2 位按百分之一秒、3 位按毫秒换算
      const fraction = Number((match[3] ?? '').padEnd(3, '0').slice(0, 3))
      times.push(minutes * 60000 + seconds * 1000 + fraction)
    }
    // 无时间戳（ti/ar/al/by 等元数据行）跳过
    if (times.length === 0)
      continue
    const text = line.replace(LRC_TIME_PATTERN, '').trim()
    if (!text)
      continue
    for (const time of times) {
      items.push({ time, text, translate: null })
    }
  }

  items.sort((a, b) => a.time - b.time)
  return items
}

/**
 * 把 SDK lyric 返回体映射为领域歌词（纯函数，便于单测）。
 * lrc 解析为主歌词；tlyric 中时间戳与主歌词一致的行并入 translate；
 * 纯音乐（nolyric）、歌词未收录（uncollected）或 lrc 为空时如实返回空数组。
 */
export function mapLyricBody(body: unknown): LyricItem[] {
  const raw = asRecord(body)
  if (raw.nolyric === true || raw.nolyric === 'true' || raw.uncollected === true || raw.uncollected === 'true') {
    return []
  }

  const lrcText = asString(asRecord(raw.lrc).lyric)
  if (!lrcText)
    return []

  const items = parseLrc(lrcText)
  const tlyricText = asString(asRecord(raw.tlyric).lyric)
  if (!tlyricText)
    return items

  // 时间戳 → 翻译文本（同时间多条取首条），只有主歌词行时间戳精确对齐才并入
  const translateByTime = new Map<number, string>()
  for (const item of parseLrc(tlyricText)) {
    if (!translateByTime.has(item.time))
      translateByTime.set(item.time, item.text)
  }
  return items.map(item => ({ ...item, translate: translateByTime.get(item.time) ?? null }))
}

/** 歌词：按歌曲 id 调用 SDK 并映射为领域歌词；失败抛 NcmError */
export async function ncmLyric(ctx: NcmCallContext, id: number): Promise<LyricItem[]> {
  try {
    const res = await sdkLyric({ id }, sdkConfig(ctx.cookie))
    // 上游偶发「HTTP 200 + 业务失败码」（如 -110 无版权）的返回形态，按门面错误模型映射
    assertOkBody(res)
    return mapLyricBody(res.body)
  }
  catch (err) {
    throw mapNcmError(err)
  }
}
