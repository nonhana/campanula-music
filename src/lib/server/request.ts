import type { CollectRequest, CreatePlaylistRequest, DescribePlaylistRequest, HeartRequest, PlaylistCollectRequest, RenamePlaylistRequest, TagPlaylistRequest } from '#lib/api/library.js'
import type { CheckInRequest, PlaySource, Quality } from '#lib/api/playback.js'
import type { SearchKind } from '#lib/api/search.js'
import { error } from '@sveltejs/kit'
import { nameProblem, PLAYLIST_DESCRIPTION_LENGTH, PLAYLIST_NAME_WIDTH, PLAYLIST_TAGS_MAX } from '#lib/api/library.js'
import { NUMBERED_SOURCE_KINDS, QUALITIES } from '#lib/api/playback.js'
import { SEARCH_KINDS } from '#lib/api/search.js'

/** 中国大陆手机号（+86）：1 开头的 11 位数字 */
export const PHONE = /^1\d{10}$/
/** 短信验证码：4 到 6 位数字 */
export const CAPTCHA = /^\d{4,6}$/
/** 二维码的 key（网易云给的 UUID） */
export const QR_KEY = /^[\w-]{1,64}$/
/** 网易云的反作弊令牌（Watchman 给的，实测 170 个字符）：可见的 ASCII 字符，不含空白 */
const CHECK_TOKEN = /^[\x21-\x7E]{1,1024}$/

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

/** 读网址里搜索结果是哪一类（单曲、歌单、歌手、专辑） */
export function readSearchKind(value: string): SearchKind {
  const kind = SEARCH_KINDS.find(each => each === value)
  if (!kind)
    error(400, 'kind 的格式不对')
  return kind
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

/** 读请求体（JSON）里的一个对象；不是对象时当作空的 */
async function readObject(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null)
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {}
}

/** 读红心的请求体（JSON）：哪首歌，红心还是取消红心 */
export async function readHeart(request: Request): Promise<HeartRequest> {
  const { songId, hearted } = await readObject(request)
  if (!isNeteaseId(songId) || typeof hearted !== 'boolean')
    error(400, '要有 songId 和 hearted')
  return { songId, hearted }
}

/** 读收藏专辑、歌手的请求体（JSON）：收藏还是取消收藏 */
export async function readCollect(request: Request): Promise<CollectRequest> {
  const { collected } = await readObject(request)
  if (typeof collected !== 'boolean')
    error(400, '要有 collected')
  return { collected }
}

/** 读收藏歌单的请求体（JSON）：收藏时要带着反作弊令牌，取消收藏不带 */
export async function readPlaylistCollect(request: Request): Promise<PlaylistCollectRequest> {
  const { collected, checkToken } = await readObject(request)
  if (collected === false)
    return { collected }
  if (collected !== true || typeof checkToken !== 'string' || !CHECK_TOKEN.test(checkToken))
    error(400, '收藏歌单要有 collected 和 checkToken')
  return { collected, checkToken }
}

/** 读歌单名称：去掉首尾空白后要能提交（不是空的，不超过 PLAYLIST_NAME_WIDTH 个宽度） */
function readPlaylistName(name: unknown): string {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (nameProblem(trimmed))
    error(400, `name 要有 1 到 ${PLAYLIST_NAME_WIDTH} 个宽度（汉字算 2）`)
  return trimmed
}

/** 读新建歌单的请求体（JSON）：名称，是不是隐私歌单 */
export async function readPlaylistDraft(request: Request): Promise<CreatePlaylistRequest> {
  const { name, private: isPrivate } = await readObject(request)
  if (typeof isPrivate !== 'boolean')
    error(400, '要有 private')
  return { name: readPlaylistName(name), private: isPrivate }
}

/** 读改名称的请求体（JSON） */
export async function readPlaylistRename(request: Request): Promise<RenamePlaylistRequest> {
  const { name } = await readObject(request)
  return { name: readPlaylistName(name) }
}

/** 读改简介的请求体（JSON）：最多 PLAYLIST_DESCRIPTION_LENGTH 个字，可以是空的（清空） */
export async function readPlaylistDescription(request: Request): Promise<DescribePlaylistRequest> {
  const { description } = await readObject(request)
  if (typeof description !== 'string' || description.length > PLAYLIST_DESCRIPTION_LENGTH)
    error(400, `description 最多 ${PLAYLIST_DESCRIPTION_LENGTH} 个字`)
  return { description }
}

/** 一个标签：不是空的；网易云用分号把几个标签连起来交上去，所以不能有分号 */
const TAG = /^[^;\s][^;]*$/

/** 读换标签的请求体（JSON）：0 到 PLAYLIST_TAGS_MAX 个不重复的标签 */
export async function readPlaylistTags(request: Request): Promise<TagPlaylistRequest> {
  const { tags } = await readObject(request)
  if (!Array.isArray(tags) || tags.length > PLAYLIST_TAGS_MAX || !tags.every(tag => typeof tag === 'string' && TAG.test(tag)) || new Set(tags).size !== tags.length)
    error(400, `tags 要有 0 到 ${PLAYLIST_TAGS_MAX} 个不重复的标签`)
  return { tags }
}
