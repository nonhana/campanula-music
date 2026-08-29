import type { NcmSearchArtist, NcmSearchPage, NcmSearchPlaylist, NcmSearchSong } from '$lib/types'
import type { NcmCallContext, NcmSearchParams } from './types'
/**
 * 网易云搜索门面实现。
 *
 * 实现 NcmProvider.search（见 ./types）：调用 hana-music-api 的 search，
 * 把 SDK 返回体映射为领域形状 NcmSearchPage；失败统一映射为 NcmError。
 * SDK 原始返回使用网易云字段（songs/playlists/artists + 计数），
 * 映射按「拿得到就用、缺失回落空值」处理，不做服务端二次补全。
 */
import { search as sdkSearch } from 'hana-music-api'
import { mapNcmError } from './errors'
import { asArray, asImageUrl, asNumber, asRecord, asString, sdkConfig } from './raw'
import { fetchCoverMapByIds } from './songDetail'

/** 网易云搜索 type 参数：1 单曲 / 1000 歌单 / 100 歌手 */
const SDK_SEARCH_TYPE: Record<NcmSearchParams['type'], number> = {
  song: 1,
  playlist: 1000,
  artist: 100,
}

/** 默认分页大小 */
const DEFAULT_LIMIT = 30

interface RawSearchBody {
  result?: {
    songs?: unknown[]
    playlists?: unknown[]
    artists?: unknown[]
    songCount?: number
    playlistCount?: number
    artistCount?: number
  }
}

interface RawArtistRef {
  id?: unknown
  name?: unknown
}

interface RawSong {
  id?: unknown
  name?: unknown
  duration?: unknown
  artists?: unknown[]
  album?: unknown | null
}

interface RawPlaylist {
  id?: unknown
  name?: unknown
  coverImgUrl?: unknown
  trackCount?: unknown
  playCount?: unknown
  creator?: unknown | null
}

interface RawArtist {
  id?: unknown
  name?: unknown
  picUrl?: unknown
}

function mapSongs(raw: unknown[]): NcmSearchSong[] {
  return raw.map((item): NcmSearchSong => {
    const song = asRecord(item) as RawSong
    const album = asRecord(song.album)
    return {
      id: asNumber(song.id),
      name: asString(song.name),
      duration: asNumber(song.duration),
      artists: asArray(song.artists).map((a) => {
        const artist = asRecord(a) as RawArtistRef
        return { id: asNumber(artist.id), name: asString(artist.name) }
      }),
      album: {
        id: asNumber(album.id),
        name: asString(album.name),
        cover: '',
      },
    }
  })
}

function mapPlaylists(raw: unknown[]): NcmSearchPlaylist[] {
  return raw.map((p) => {
    const playlist = asRecord(p) as RawPlaylist
    const creator = asRecord(playlist.creator)
    return {
      id: asNumber(playlist.id),
      name: asString(playlist.name),
      cover: asImageUrl(playlist.coverImgUrl),
      trackCount: asNumber(playlist.trackCount),
      playCount: asNumber(playlist.playCount),
      creator: asString(creator.nickname),
    }
  })
}

function mapArtists(raw: unknown[]): NcmSearchArtist[] {
  return raw.map((a) => {
    const artist = asRecord(a) as RawArtist
    return {
      id: asNumber(artist.id),
      name: asString(artist.name),
      avatar: asImageUrl(artist.picUrl),
    }
  })
}

/** 把 SDK search 返回体映射为领域形状（纯函数，便于单测） */
export function mapSearchPage(type: NcmSearchParams['type'], body: unknown): NcmSearchPage {
  const result = asRecord(asRecord(body).result) as RawSearchBody['result']
  if (type === 'song') {
    const songs = mapSongs(asArray(result?.songs))
    return { type: 'song', songs, total: asNumber(result?.songCount) || songs.length }
  }
  if (type === 'playlist') {
    const playlists = mapPlaylists(asArray(result?.playlists))
    return { type: 'playlist', playlists, total: asNumber(result?.playlistCount) || playlists.length }
  }
  const artists = mapArtists(asArray(result?.artists))
  return { type: 'artist', artists, total: asNumber(result?.artistCount) || artists.length }
}

/** 搜索歌曲/歌单/歌手：调用 SDK 并映射为领域结果；失败抛 NcmError */
export async function ncmSearch(ctx: NcmCallContext, params: NcmSearchParams): Promise<NcmSearchPage> {
  try {
    const query = {
      keywords: params.keywords,
      type: SDK_SEARCH_TYPE[params.type],
      limit: params.limit ?? DEFAULT_LIMIT,
      offset: params.offset ?? 0,
    }
    const res = await sdkSearch(query, sdkConfig(ctx.cookie))
    const page = mapSearchPage(params.type, res.body)
    if (page.type !== 'song')
      return page
    // 封面回填：搜索接口不返回专辑封面，借一次批量 song/detail 补齐；失败不阻断搜索（封面留空）
    const covers = await fetchCoverMapByIds(ctx, page.songs.map(song => song.id))
    return {
      ...page,
      songs: page.songs.map(song => ({ ...song, album: { ...song.album, cover: covers.get(song.id) ?? song.album.cover } })),
    }
  }
  catch (err) {
    throw mapNcmError(err)
  }
}
