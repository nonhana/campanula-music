import type { NcmSongSource, NcmSoundLevel } from '$lib/types'
import type { NcmCallContext } from './types'
/**
 * 网易云播放地址门面实现。
 *
 * 实现 NcmProvider.songUrl（见 ./types）：调用 hana-music-api 的 songUrlV1，
 * 把 SDK 返回体映射为领域形状 NcmSongSource[]，命中试听片段/无版权限制如实呈现。
 * 失败统一映射为 NcmError（见 ./errors）。
 */
import { songUrlV1 as sdkSongUrlV1 } from 'hana-music-api'
import { mapNcmError } from './errors'
import { asArray, asHttpUrl, asNumber, asRecord, assertOkBody, chunkIds, sdkConfig, TRACK_CHUNK_SIZE } from './raw'

/** 播放地址请求：歌曲 id 数组 + 音质档位 */
export interface SongUrlRequest {
  ids: number[]
  level: NcmSoundLevel
}

interface RawUrlEntry {
  id?: unknown
  url?: unknown
  freeTrialInfo?: unknown
}

/**
 * 把 SDK song/url/v1 返回体的 data 列表映射为领域来源（纯函数，便于单测）。
 * 条目按请求 ids 顺序对齐：url 缺失/为空 → unavailable；freeTrialInfo 含起止 → trial。
 */
export function mapSongUrlList(body: unknown, ids: number[]): NcmSongSource[] {
  const data = asArray(asRecord(body).data)
  return ids.map((id, index) => {
    const entry = asRecord(data[index]) as RawUrlEntry
    // 上游 data 可能与请求 id 错位或缺条目：id 不匹配时该曲按 unavailable 处理，不整体失败
    if (asNumber(entry.id) !== id) {
      return { id, status: 'unavailable', url: null, trial: null }
    }
    const url = asHttpUrl(entry.url)
    if (!url) {
      return { id, status: 'unavailable', url: null, trial: null }
    }
    const trialInfo = asRecord(entry.freeTrialInfo)
    const hasTrial = typeof trialInfo.start === 'number' && typeof trialInfo.end === 'number'
    return hasTrial
      ? { id, status: 'trial', url, trial: { start: asNumber(trialInfo.start), end: asNumber(trialInfo.end) } }
      : { id, status: 'playable', url, trial: null }
  })
}

/** 播放地址：按音质档位分片请求并返回对齐到 ids 的来源列表；失败抛 NcmError */
export async function ncmSongUrl(ctx: NcmCallContext, request: SongUrlRequest): Promise<NcmSongSource[]> {
  try {
    const chunks = chunkIds(request.ids, TRACK_CHUNK_SIZE)
    const lists = await Promise.all(
      chunks.map(async (ids) => {
        const res = await sdkSongUrlV1({ id: ids.join(','), level: request.level }, sdkConfig(ctx.cookie))
        assertOkBody(res)
        return mapSongUrlList(res.body, ids)
      }),
    )
    return lists.flat()
  }
  catch (err) {
    throw mapNcmError(err)
  }
}
