import { error } from '@sveltejs/kit'

import type { SetCoverRequest } from '#lib/api/cover.js'
import type { PostEndpoint } from '#lib/api/endpoint.js'
import type { ArtistSongOrder, CollectRequest, CreatePlaylistRequest, DescribePlaylistRequest, HeartRequest, PlaylistCollectRequest, RenamePlaylistRequest, TagPlaylistRequest } from '#lib/api/library.js'
import { ARTIST_SONG_ORDERS, nameProblem, PLAYLIST_DESCRIPTION_LENGTH, PLAYLIST_NAME_WIDTH, PLAYLIST_TAGS_MAX } from '#lib/api/library.js'
import type { CheckInRequest, PlaySource, Quality } from '#lib/api/playback.js'
import { NUMBERED_SOURCE_KINDS, QUALITIES } from '#lib/api/playback.js'
import type { SearchKind } from '#lib/api/search.js'
import { SEARCH_KINDS } from '#lib/api/search.js'

/** 二维码的 key（网易云给的 UUID） */
export const QR_KEY = /^[\w-]{1,64}$/
/** 网易云的反作弊令牌（Watchman 给的，实测 170 个字符）：可见的 ASCII 字符，不含空白 */
const CHECK_TOKEN = /^[\x21-\x7E]{1,1024}$/

// 界面发请求前已经检查过格式，到这里还不对，说明请求不是 Campanula 的页面发的：回 400

/** 读 JSON 里的字符串字段，每个都要符合格式 */
export const readFields = async <K extends string>(request: Request, patterns: Record<K, RegExp>): Promise<Record<K, string>> => {
  const body: unknown = await request.json().catch(() => null)
  const fields = {} as Record<K, string>
  for (const name of Object.keys(patterns) as K[]) {
    const value = typeof body === 'object' && body !== null && name in body
      ? (body as Record<K, unknown>)[name]
      : undefined
    if (typeof value !== 'string' || !patterns[name].test(value))
      error(400, `${name} 的格式不对`)
    fields[name] = value
  }
  return fields
}

/** 网易云的编号（uid、歌单、歌曲）：正整数 */
const isNeteaseId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0

/** 读查询参数里的一个编号；路径参数由 src/params.ts 的 neteaseId 匹配器处理 */
export const readId = (name: string, value: string | null | undefined): number => {
  const id = /^\d{1,16}$/.test(value ?? '')
    ? Number(value)
    : Number.NaN
  if (!isNeteaseId(id))
    error(400, `${name} 的格式不对`)
  return id
}

/** 请求体里装编号列表的键：由请求类型定，写错键编译不过 */
type IdListKey<Body> = { [K in keyof Body]-?: Body[K] extends number[] ? K : never }[keyof Body] & string

/** 读 JSON 里的编号列表，1 到 max 个；键和端点的请求体类型绑在一起（readIds(endpoints.songs, request, 'ids', …)），写错编译不过 */
export const readIds = async <Body>(_endpoint: Pick<PostEndpoint<unknown, Body, unknown>, 'request'>, request: Request, name: IdListKey<NonNullable<Body>>, max: number): Promise<number[]> => {
  const body: unknown = await request.json().catch(() => null)
  const ids = typeof body === 'object' && body !== null && name in body
    ? (body as Record<string, unknown>)[name]
    : undefined
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > max || !ids.every(isNeteaseId))
    error(400, `${name} 要有 1 到 ${max} 个编号`)
  return ids
}

/** 读网址里分页的 offset：从第几个起，0 或正整数 */
export const readOffset = (value: string | null): number => {
  if (!/^\d{1,6}$/.test(value ?? ''))
    error(400, 'offset 的格式不对')
  return Number(value)
}

export const readQuality = (value: string | null): Quality => {
  const quality = QUALITIES.find(item => item === value)
  if (!quality)
    error(400, 'quality 的格式不对')
  return quality
}

/** 读网址里的搜索关键词：去掉首尾空白后不能是空的 */
export const readKeywords = (value: string | null): string => {
  const keywords = value?.trim() ?? ''
  if (!keywords)
    error(400, 'keywords 不能是空的')
  return keywords
}

export const readSearchKind = (value: string): SearchKind => {
  const kind = SEARCH_KINDS.find(each => each === value)
  if (!kind)
    error(400, 'kind 的格式不对')
  return kind
}

export const readArtistSongOrder = (value: string | null): ArtistSongOrder => {
  const order = ARTIST_SONG_ORDERS.find(each => each === value)
  if (!order)
    error(400, 'order 的格式不对')
  return order
}

/** 读请求里的播放来源：每日推荐、已下载没有编号，一次搜索带着搜的词，其余要带编号 */
const readSource = (source: unknown): PlaySource => {
  const { kind, id, keyword } = (typeof source === 'object' && source !== null
    ? source
    : {}) as Partial<Record<'kind' | 'id' | 'keyword', unknown>>
  if (kind === 'daily' || kind === 'downloads')
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
export const readCheckIn = async (request: Request): Promise<CheckInRequest> => {
  const body: unknown = await request.json().catch(() => null)
  const { source, seconds } = (typeof body === 'object' && body !== null
    ? body
    : {}) as Partial<Record<keyof CheckInRequest, unknown>>
  const playSource = readSource(source)
  if (!Number.isSafeInteger(seconds) || (seconds as number) <= 0)
    error(400, 'seconds 要是正整数')
  return { source: playSource, seconds: seconds as number }
}

/** 读请求体（JSON）里的一个对象；不是对象时当作空的 */
const readObject = async (request: Request): Promise<Record<string, unknown>> => {
  const body: unknown = await request.json().catch(() => null)
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {}
}

export const readHeart = async (request: Request): Promise<HeartRequest> => {
  const { songId, hearted } = await readObject(request)
  if (!isNeteaseId(songId) || typeof hearted !== 'boolean')
    error(400, '要有 songId 和 hearted')
  return { songId, hearted }
}

export const readCollect = async (request: Request): Promise<CollectRequest> => {
  const { collected } = await readObject(request)
  if (typeof collected !== 'boolean')
    error(400, '要有 collected')
  return { collected }
}

/** 读收藏歌单的请求体（JSON）：收藏时要带着反作弊令牌，取消收藏不带 */
export const readPlaylistCollect = async (request: Request): Promise<PlaylistCollectRequest> => {
  const { collected, checkToken } = await readObject(request)
  if (collected === false)
    return { collected }
  if (collected !== true || typeof checkToken !== 'string' || !CHECK_TOKEN.test(checkToken))
    error(400, '收藏歌单要有 collected 和 checkToken')
  return { collected, checkToken }
}

/** 读歌单名称：去掉首尾空白后要能提交（不是空的，不超过 PLAYLIST_NAME_WIDTH 个宽度） */
const readPlaylistName = (name: unknown): string => {
  const trimmed = typeof name === 'string'
    ? name.trim()
    : ''
  if (nameProblem(trimmed))
    error(400, `name 要有 1 到 ${PLAYLIST_NAME_WIDTH} 个宽度（汉字算 2）`)
  return trimmed
}

export const readPlaylistDraft = async (request: Request): Promise<CreatePlaylistRequest> => {
  const { name, private: isPrivate } = await readObject(request)
  if (typeof isPrivate !== 'boolean')
    error(400, '要有 private')
  return {
    name: readPlaylistName(name),
    private: isPrivate,
  }
}

export const readPlaylistRename = async (request: Request): Promise<RenamePlaylistRequest> => {
  const { name } = await readObject(request)
  return {
    name: readPlaylistName(name),
  }
}

/** 读改简介的请求体（JSON）：最多 PLAYLIST_DESCRIPTION_LENGTH 个字，可以是空的（清空） */
export const readPlaylistDescription = async (request: Request): Promise<DescribePlaylistRequest> => {
  const { description } = await readObject(request)
  if (typeof description !== 'string' || description.length > PLAYLIST_DESCRIPTION_LENGTH)
    error(400, `description 最多 ${PLAYLIST_DESCRIPTION_LENGTH} 个字`)
  return { description }
}

/** 一个标签：不是空的；网易云用分号把几个标签连起来交上去，所以不能有分号 */
const TAG = /^[^;\s][^;]*$/

/** 读换标签的请求体（JSON）：0 到 PLAYLIST_TAGS_MAX 个不重复的标签 */
export const readPlaylistTags = async (request: Request): Promise<TagPlaylistRequest> => {
  const { tags } = await readObject(request)
  if (!Array.isArray(tags) || tags.length > PLAYLIST_TAGS_MAX || !tags.every(tag => typeof tag === 'string' && TAG.test(tag)) || new Set(tags).size !== tags.length)
    error(400, `tags 要有 0 到 ${PLAYLIST_TAGS_MAX} 个不重复的标签`)
  return { tags }
}

/** 读设为封面的请求体（JSON）：直传成功的图片编号（网易云给的一长串数字，超出 JavaScript 的安全整数，按字符串收） */
export const readCoverImage = async (request: Request): Promise<SetCoverRequest> => {
  const { imgId } = await readObject(request)
  if (typeof imgId !== 'string' || !/^\d{1,20}$/.test(imgId))
    error(400, 'imgId 的格式不对')
  return { imgId }
}
