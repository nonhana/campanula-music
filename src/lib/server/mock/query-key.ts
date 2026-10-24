// 录制数据的查询键：mock 按模块 + 查询匹配录制。查询里有上千个编号的长列表（song_detail 的 ids、排序的 ids），
// 索引里存完整的会把索引撑到 MB 级，所以长字符串换成它的摘要；匹配时两边算同一个键。
import { createHash } from 'node:crypto'

/** 超过这么长的字符串只留摘要：1000 个编号连起来约 10 KB */
const LONG_VALUE = 256

const digest = (value: string): string => `#sha256:${createHash('sha256').update(value).digest('hex')}:${value.length}`

const canonical = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.length > LONG_VALUE
      ? digest(value)
      : value
  }
  if (Array.isArray(value))
    return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [
      key,
      canonical((value as Record<string, unknown>)[key]),
    ]))
  }
  return value
}

/** 模块 + 查询参数的稳定键，JSON 的键按字母排，长字符串按摘要 */
export const queryKey = (query: unknown): string => JSON.stringify(canonical(query))
