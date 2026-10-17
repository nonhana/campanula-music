import type { CheckInRequest, PlaySource, Quality } from '#lib/api/playback.js'
import { error } from '@sveltejs/kit'
import { NUMBERED_SOURCE_KINDS, QUALITIES } from '#lib/api/playback.js'

/** 中国大陆手机号（+86）：1 开头的 11 位数字 */
export const PHONE = /^1\d{10}$/
/** 短信验证码：4 到 6 位数字 */
export const CAPTCHA = /^\d{4,6}$/
/** 二维码的 key（网易云给的 UUID） */
export const QR_KEY = /^[\w-]{1,64}$/

// 界面发请求前已经检查过格式，到这里还不对，说明请求不是 Campanula 的页面发的：回 400

/**
 * 读请求体（JSON）里的字符串字段，每个都要符合格式
 */
export async function readFields<K extends string>(request: Request, patterns: Record<K, RegExp>): Promise<Record<K, string>> {
  const body: unknown = await request.json().catch(() => null)
  const fields = {} as Record<K, string>
  for (const name of Object.keys(patterns) as K[]) {
    const value = typeof body === 'object' && body !== null && name in body ? (body as Record<K, unknown>)[name] : undefined
    if (typeof value !== 'string' || !patterns[name].test(value))
      error(400, `${name} 的格式不对`)
    fields[name] = value
  }
  return fields
}

/** 网易云的编号（uid、歌单、歌曲）：正整数 */
function isNeteaseId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

/** 读网址里的一个编号（查询参数或路径参数） */
export function readId(name: string, value: string | null | undefined): number {
  const id = /^\d{1,16}$/.test(value ?? '') ? Number(value) : Number.NaN
  if (!isNeteaseId(id))
    error(400, `${name} 的格式不对`)
  return id
}

/** 读请求体（JSON）里的编号列表：1 到 max 个 */
export async function readIds(request: Request, name: string, max: number): Promise<number[]> {
  const body: unknown = await request.json().catch(() => null)
  const ids = typeof body === 'object' && body !== null && name in body ? (body as Record<string, unknown>)[name] : undefined
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > max || !ids.every(isNeteaseId))
    error(400, `${name} 要有 1 到 ${max} 个编号`)
  return ids
}

/** 读网址里分页的 offset：从第几个起，0 或正整数 */
export function readOffset(value: string | null): number {
  if (!/^\d{1,6}$/.test(value ?? ''))
    error(400, 'offset 的格式不对')
  return Number(value)
}

/** 读网址里的音质 */
export function readQuality(value: string | null): Quality {
  const quality = QUALITIES.find(item => item === value)
  if (!quality)
    error(400, 'quality 的格式不对')
  return quality
}

/** 读网址里的搜索关键词：去掉首尾空白后不能是空的 */
export function readKeywords(value: string | null): string {
  const keywords = value?.trim() ?? ''
  if (!keywords)
    error(400, 'keywords 不能是空的')
  return keywords
}

/** 读请求里的播放来源：每日推荐没有编号，一次搜索带着搜的词，其余要带编号 */
function readSource(source: unknown): PlaySource {
  const { kind, id, keyword } = (typeof source === 'object' && source !== null ? source : {}) as Partial<Record<'kind' | 'id' | 'keyword', unknown>>
  if (kind === 'daily')
    return { kind }
  if (kind === 'search') {
    if (typeof keyword !== 'string' || !keyword.trim())
      error(400, 'source 的格式不对')
    return { kind, keyword }
  }
  const numbered = NUMBERED_SOURCE_KINDS.find(each => each === kind)
  if (!numbered || !isNeteaseId(id))
    error(400, 'source 的格式不对')
  return { kind: numbered, id }
}

/** 读听歌打卡的请求体（JSON）：播放来源，实际听了多少秒（正整数） */
export async function readCheckIn(request: Request): Promise<CheckInRequest> {
  const body: unknown = await request.json().catch(() => null)
  const { source, seconds } = (typeof body === 'object' && body !== null ? body : {}) as Partial<Record<keyof CheckInRequest, unknown>>
  const playSource = readSource(source)
  if (!Number.isSafeInteger(seconds) || (seconds as number) <= 0)
    error(400, 'seconds 要是正整数')
  return { source: playSource, seconds: seconds as number }
}
