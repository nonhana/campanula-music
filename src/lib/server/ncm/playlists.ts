import type {
  NcmPlaylist,
  NcmPlaylistDetail,
  NcmSong,
  NcmUserPlaylists,
} from '$lib/types'
import type { NcmCallContext } from './types'
import {
  playlistDetail as sdkPlaylistDetail,
  songDetail as sdkSongDetail,
  userPlaylistCollect as sdkUserPlaylistCollect,
  userPlaylistCreate as sdkUserPlaylistCreate,
} from 'hana-music-api'
import { mapNcmError } from './errors'
import { asArray, asImageUrl, asNumber, asRecord, asString, sdkConfig } from './raw'

/** 单次 song/detail 请求的歌曲数上限（网易云对单请求 id 数有上限，分片防截断） */
const TRACK_CHUNK_SIZE = 1000

/** 我的歌单每组拉取数量（两组各自单页，分页留待后续） */
const USER_PLAYLIST_LIMIT = 100

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

function chunkIds(ids: number[], size: number): number[][] {
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += size)
    chunks.push(ids.slice(i, i + size))
  return chunks
}

/** 按完整 trackIds 分片请求歌曲详情，缺失歌曲跳过，并归位到歌单顺序 */
async function fetchSongsInOrder(ctx: NcmCallContext, ids: number[]): Promise<NcmSong[]> {
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

/** 歌单详情：实时拉取并用完整 trackIds 补全全部歌曲；失败抛 NcmError */
export async function ncmPlaylistDetail(ctx: NcmCallContext, id: number): Promise<NcmPlaylistDetail> {
  try {
    const res = await sdkPlaylistDetail({ id: String(id) }, sdkConfig(ctx.cookie))
    const { trackIds, ...header } = parsePlaylistDetail(res.body)
    const songs = await fetchSongsInOrder(ctx, trackIds)
    return { ...header, songs }
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
      created: mapUserPlaylists(asArray(asRecord(createdRes.body).playlist)),
      collected: mapUserPlaylists(asArray(asRecord(collectedRes.body).playlist)),
    }
  }
  catch (err) {
    throw mapNcmError(err)
  }
}
