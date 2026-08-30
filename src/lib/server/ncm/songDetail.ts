import type { NcmSong } from '$lib/types'
import type { NcmCallContext } from './types'
/**
 * 歌曲详情门面助手：SDK song/detail 返回体映射与按序补全。
 *
 * 红心歌曲列表补全（like.ts）使用：按红心 id 顺序分片请求详情，缺失歌曲跳过并归位到输入顺序。
 * 失败由调用方统一映射为 NcmError。
 */
import { songDetail as sdkSongDetail } from 'hana-music-api'
import { NcmError } from './errors'
import { asArray, asImageUrl, asNumber, asRecord, assertOkBody, asString, chunkIds, sdkConfig, TRACK_CHUNK_SIZE } from './raw'

interface RawArtistRef {
  id?: unknown
  name?: unknown
}

interface RawSong {
  id?: unknown
  name?: unknown
  dt?: unknown
  ar?: unknown[]
  al?: unknown | null
}

/** 把 SDK song/detail 返回体的歌曲数组映射为领域歌曲（纯函数，便于单测） */
export function mapSongDetailList(body: unknown): NcmSong[] {
  const songs = asRecord(body).songs
  if (!Array.isArray(songs))
    return []
  return songs.map((item): NcmSong => {
    const song = asRecord(item) as RawSong
    const album = asRecord(song.al)
    return {
      id: asNumber(song.id),
      name: asString(song.name),
      duration: asNumber(song.dt),
      artists: asArray(song.ar).map((a) => {
        const artist = asRecord(a) as RawArtistRef
        return { id: asNumber(artist.id), name: asString(artist.name) }
      }),
      album: {
        id: asNumber(album.id),
        name: asString(album.name),
        cover: asImageUrl(album.picUrl),
      },
    }
  })
}

/** 单分片详情请求：业务失败码复核 + 映射为领域歌曲 */
async function fetchChunk(ctx: NcmCallContext, chunk: number[]): Promise<NcmSong[]> {
  const res = await sdkSongDetail({ ids: chunk.join(',') }, sdkConfig(ctx.cookie))
  assertOkBody(res)
  return mapSongDetailList(res.body)
}

/**
 * 按完整 id 顺序分片请求歌曲详情，缺失歌曲跳过并归位到输入顺序。
 * 分片经 allSettled 并行：失败分片重试 1 次（单分片网络抖动不应打挂整个补全列表）；
 * 重试仍失败则整体抛 RESOURCE_UNAVAILABLE——诚实失败优先于静默缺歌。
 */
export async function fetchSongsInOrderByIds(ctx: NcmCallContext, ids: number[]): Promise<NcmSong[]> {
  const chunks = chunkIds(ids, TRACK_CHUNK_SIZE)
  const first = await Promise.allSettled(chunks.map(chunk => fetchChunk(ctx, chunk)))
  const retried = await Promise.allSettled(
    first.map((settled, i) => (settled.status === 'rejected' ? fetchChunk(ctx, chunks[i]) : Promise.resolve<NcmSong[]>([]))),
  )
  const firstFailure = first.find((settled): settled is PromiseRejectedResult => settled.status === 'rejected')
  const okLists: NcmSong[][] = []
  for (const list of first.map((settled, i) => {
    if (settled.status === 'fulfilled')
      return settled.value
    const retry = retried[i]
    return retry.status === 'fulfilled' ? retry.value : null
  })) {
    if (list === null) {
      // 诚实失败优先于静默缺歌：重试仍失败则整体抛错，避免用户看到残缺列表误以为完整
      throw new NcmError('RESOURCE_UNAVAILABLE', '歌曲详情暂时不可用，请稍后重试', { cause: firstFailure?.reason })
    }
    okLists.push(list)
  }
  const byId = new Map<number, NcmSong>(okLists.flat().map(song => [song.id, song]))
  return ids.map(id => byId.get(id)).filter((song): song is NcmSong => song !== undefined)
}

/**
 * 按 id 批量取专辑封面（一次 song/detail 批量请求），失败容忍返回空 Map。
 * 供搜索封面回填使用：回填是锦上添花，任何失败都不阻断主流程；
 * 此处有意不做 assertOkBody 业务码复核——业务失败同样回落空 Map，封面留空即可。
 */
export async function fetchCoverMapByIds(ctx: NcmCallContext, ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0)
    return new Map()
  try {
    const res = await sdkSongDetail({ ids: ids.join(',') }, sdkConfig(ctx.cookie))
    return new Map(mapSongDetailList(res.body).map(song => [song.id, song.album.cover]))
  }
  catch {
    return new Map()
  }
}
