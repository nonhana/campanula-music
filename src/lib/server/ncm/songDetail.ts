import type { NcmSong } from '$lib/types'
import type { NcmCallContext } from './types'
/**
 * 歌曲详情门面助手：SDK song/detail 返回体映射与按序补全。
 *
 * 歌单详情补全（playlists.ts）与红心歌曲列表补全（like.ts）共用：
 * 按完整 trackIds / 红心 id 顺序分片请求详情，缺失歌曲跳过并归位到输入顺序。
 * 失败由调用方统一映射为 NcmError。
 */
import { songDetail as sdkSongDetail } from 'hana-music-api'
import { asArray, asImageUrl, asNumber, asRecord, asString, chunkIds, sdkConfig, TRACK_CHUNK_SIZE } from './raw'

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

/** 按完整 id 顺序分片请求歌曲详情，缺失歌曲跳过并归位到输入顺序 */
export async function fetchSongsInOrderByIds(ctx: NcmCallContext, ids: number[]): Promise<NcmSong[]> {
  const chunks = chunkIds(ids, TRACK_CHUNK_SIZE)
  const rawLists = await Promise.all(
    chunks.map(async (chunk) => {
      const res = await sdkSongDetail({ ids: chunk.join(',') }, sdkConfig(ctx.cookie))
      return mapSongDetailList(res.body)
    }),
  )
  const byId = new Map<number, NcmSong>(rawLists.flat().map(song => [song.id, song]))
  return ids.map(id => byId.get(id)).filter((song): song is NcmSong => song !== undefined)
}

/**
 * 按 id 批量取专辑封面（一次 song/detail 批量请求），失败容忍返回空 Map。
 * 供搜索封面回填使用：回填是锦上添花，任何失败都不阻断主流程。
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
