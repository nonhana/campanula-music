import type {
  NcmPlaylist,
  NcmPlaylistDetail,
  NcmSong,
  NcmUserPlaylists,
} from '$lib/types'
import type { NcmCallContext } from './types'
import {
  playlistDetail as sdkPlaylistDetail,
  playlistTrackAll as sdkPlaylistTrackAll,
  userPlaylistCollect as sdkUserPlaylistCollect,
  userPlaylistCreate as sdkUserPlaylistCreate,
} from 'hana-music-api'
import { mapNcmError } from './errors'
import { asArray, asImageUrl, asNumber, asRecord, asString, sdkConfig } from './raw'
import { mapSongDetailList } from './songDetail'

/** 我的歌单每组拉取数量（两组各自单页，分页留待后续） */
const USER_PLAYLIST_LIMIT = 100

interface RawPlaylist {
  id?: unknown
  name?: unknown
  coverImgUrl?: unknown
  creator?: unknown | null
  description?: unknown
  trackCount?: unknown
  playCount?: unknown
  trackIds?: unknown[]
}

/** 歌单详情解析结果：头信息 + 完整 trackIds（详情接口的 tracks 不完整，须另行补全） */
export interface PlaylistDetailParts {
  id: number
  name: string
  cover: string
  creator: string
  description: string | null
  trackCount: number
  playCount: number
  trackIds: number[]
}

/** 把 SDK playlist/detail 返回体解析为头信息与完整 trackIds（纯函数，便于单测） */
export function parsePlaylistDetail(body: unknown): PlaylistDetailParts {
  const playlist = asRecord(asRecord(body).playlist) as RawPlaylist
  return {
    id: asNumber(playlist.id),
    name: asString(playlist.name),
    cover: asImageUrl(playlist.coverImgUrl),
    creator: asString(asRecord(playlist.creator).nickname),
    description: playlist.description == null ? null : asString(playlist.description),
    trackCount: asNumber(playlist.trackCount),
    playCount: asNumber(playlist.playCount),
    trackIds: Array.isArray(playlist.trackIds) ? playlist.trackIds.map(t => asNumber(asRecord(t).id)) : [],
  }
}

/** 把 SDK 用户歌单数组映射为领域条目（创建/收藏共用外形，纯函数） */
export function mapUserPlaylists(raw: unknown[]): NcmPlaylist[] {
  return raw.map((item): NcmPlaylist => {
    const playlist = asRecord(item) as RawPlaylist
    return {
      id: asNumber(playlist.id),
      name: asString(playlist.name),
      cover: asImageUrl(playlist.coverImgUrl),
      trackCount: asNumber(playlist.trackCount),
      playCount: asNumber(playlist.playCount),
      creator: asString(asRecord(playlist.creator).nickname),
    }
  })
}

/**
 * SDK user_playlist 封套解包：v1.1.x 实测返回 {data:{playlist:[...]},code}，
 * 兼容旧版顶层 {playlist:[...]} 形状（防御未来上游再变）。
 */
function unpackUserPlaylistEnvelope(body: unknown): unknown[] {
  const envelope = asRecord(body)
  return asArray(asRecord(envelope.data).playlist ?? envelope.playlist)
}

/** 歌单详情：实时拉取头信息；歌曲不随详情返回，经 ncmPlaylistTracks 分页拉取。失败抛 NcmError */
export async function ncmPlaylistDetail(ctx: NcmCallContext, id: number): Promise<NcmPlaylistDetail> {
  try {
    const res = await sdkPlaylistDetail({ id: String(id) }, sdkConfig(ctx.cookie))
    const parts = parsePlaylistDetail(res.body)
    return {
      id: parts.id,
      name: parts.name,
      cover: parts.cover,
      creator: parts.creator,
      description: parts.description,
      trackCount: parts.trackCount,
      playCount: parts.playCount,
    }
  }
  catch (err) {
    throw mapNcmError(err)
  }
}

/**
 * 歌单曲目分页：playlist/track/all 按偏移窗口请求歌曲详情（上游对每页重新解析 trackIds），
 * 缺失歌曲（已下架）跳过；失败抛 NcmError。
 */
export async function ncmPlaylistTracks(
  ctx: NcmCallContext,
  id: number,
  params: { limit: number, offset: number },
): Promise<NcmSong[]> {
  try {
    const res = await sdkPlaylistTrackAll(
      { id: String(id), limit: params.limit, offset: params.offset },
      sdkConfig(ctx.cookie),
    )
    return mapSongDetailList(res.body)
  }
  catch (err) {
    throw mapNcmError(err)
  }
}

/** 我的歌单：并行拉取创建的歌单与收藏的歌单两组；失败抛 NcmError */
export async function ncmUserPlaylists(ctx: NcmCallContext, uid: number): Promise<NcmUserPlaylists> {
  const query = { uid: String(uid), limit: USER_PLAYLIST_LIMIT, offset: 0 }
  try {
    const [createdRes, collectedRes] = await Promise.all([
      sdkUserPlaylistCreate(query, sdkConfig(ctx.cookie)),
      sdkUserPlaylistCollect(query, sdkConfig(ctx.cookie)),
    ])
    return {
      created: mapUserPlaylists(unpackUserPlaylistEnvelope(createdRes.body)),
      collected: mapUserPlaylists(unpackUserPlaylistEnvelope(collectedRes.body)),
    }
  }
  catch (err) {
    throw mapNcmError(err)
  }
}
