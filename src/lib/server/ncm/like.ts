import type { NcmSong } from '$lib/types'
import type { NcmCallContext } from './types'
/**
 * 网易云红心门面实现。
 *
 * 实现 NcmProvider.like / likedList / likedPage（见 ./types）：调用 hana-music-api 的 like / likelist，
 * 红心写回账号、喜欢列表映射为领域形状；歌曲详情补全（ncmLikedPage，支持分页与全量）
 * 供「我喜欢的音乐」页滚动分页与播放队列补全复用。
 * 失败统一映射为 NcmError（见 ./errors）。
 */
import { like as sdkLike, likelist as sdkLikelist } from 'hana-music-api'
import { mapNcmError } from './errors'
import { asNumber, asRecord, assertOkBody, sdkConfig } from './raw'
import { fetchSongsInOrderByIds } from './songDetail'

/** 红心写回参数 */
export interface LikeRequest {
  id: number
  like: boolean
}

/**
 * 把 SDK likelist 返回体映射为红心歌曲 id 列表（纯函数，便于单测）。
 * 上游 data 可能是纯数字数组或「{ id, time }」对象数组：对象带 time 时按红心时间倒序
 * （「我喜欢的音乐」按最新红心在前呈现）；偶发的顶层 ids 形态兜底；缺失回落空数组。
 */
export function mapLikedListBody(body: unknown): number[] {
  const record = asRecord(body)

  const pickIds = (items: unknown[]): number[] => {
    const entries = items
      .map((item) => {
        if (typeof item === 'number')
          return { id: item, time: 0 }
        const entry = asRecord(item)
        return { id: asNumber(entry.id), time: asNumber(entry.time) }
      })
      // 无 id（0 或非法）的条目跳过
      .filter(entry => entry.id > 0)
    // 含红心时间信息时按时间倒序（最新红心在前）；纯 id 数组保持上游顺序
    const hasTime = entries.some(entry => entry.time > 0)
    if (!hasTime)
      return entries.map(entry => entry.id)
    return entries
      .slice()
      .sort((a, b) => b.time - a.time)
      .map(entry => entry.id)
  }

  const data = record.data
  if (Array.isArray(data))
    return pickIds(data)
  if (Array.isArray(record.ids))
    return pickIds(record.ids)
  return []
}

/** 红心 / 取消红心：写回账号；成功无返回，失败抛 NcmError */
export async function ncmLike(ctx: NcmCallContext, request: LikeRequest): Promise<void> {
  try {
    const res = await sdkLike({ id: request.id, like: request.like }, sdkConfig(ctx.cookie))
    // 上游偶发「HTTP 200 + 业务失败码」的返回形态，按门面错误模型映射
    assertOkBody(res)
  }
  catch (err) {
    throw mapNcmError(err)
  }
}

/** 我喜欢的音乐 id 列表：按红心时间倒序；失败抛 NcmError */
export async function ncmLikedList(ctx: NcmCallContext, userId: number): Promise<number[]> {
  try {
    const res = await sdkLikelist({ uid: userId }, sdkConfig(ctx.cookie))
    assertOkBody(res)
    return mapLikedListBody(res.body)
  }
  catch (err) {
    throw mapNcmError(err)
  }
}

/**
 * 我喜欢的音乐分页：红心 id 列表切片后按序补全详情。
 * total 恒为红心总数（与切片窗口无关），页面据此判断是否还有下一页；
 * 缺省 request 时返回全量（播放队列补全等需要整表内容的场景）。
 */
export async function ncmLikedPage(
  ctx: NcmCallContext,
  userId: number,
  request?: { limit: number, offset: number },
): Promise<{ songs: NcmSong[], total: number }> {
  try {
    const ids = await ncmLikedList(ctx, userId)
    const window = request ? ids.slice(request.offset, request.offset + request.limit) : ids
    const songs = await fetchSongsInOrderByIds(ctx, window)
    return { songs, total: ids.length }
  }
  catch (err) {
    throw mapNcmError(err)
  }
}
