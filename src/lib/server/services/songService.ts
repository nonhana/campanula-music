import type { SongItem } from '$lib/types'
import { USER_COOKIE } from '$env/static/private'
import { getSongUrlSimple } from '$lib/crawler'
import { db } from '$lib/server/db'
import { lyricFormatter } from '$lib/server/utils/lyricFormatter'
import { count, desc, eq, inArray, like, or, sql } from 'drizzle-orm'
import { albums, artists, lyrics, songs, songsToArtists } from '../db/schema'
import { ensureHttps } from '../utils/ensureHttps'

// 获取数据库中歌曲总数
export async function getSongCount() {
  const result = await db.select({ count: count() }).from(songs)
  return result[0].count
}

// 分页获取歌曲列表
export async function getSongList(page: number, pageSize: number): Promise<SongItem[]> {
  const songsData = await db.query.songs.findMany({
    offset: (page - 1) * pageSize,
    limit: pageSize,
    with: {
      album: true,
      artists: {
        with: {
          artist: true,
        },
      },
    },
    orderBy: [desc(songs.id)],
  })
  const result = songsData.map(song => ({
    ...song,
    alias: song.alias?.split(',') ?? [],
    artists: song.artists.map(artist => ({
      id: artist.artist.id,
      name: artist.artist.name,
    })),
  }))
  return result
}

// 获取某个歌曲的详情信息
export async function getSongDetail(id: string): Promise<SongItem | null> {
  const songData = await db.query.songs.findFirst({
    where: eq(songs.id, Number(id)),
    with: {
      album: true,
      artists: {
        with: {
          artist: true,
        },
      },
      lyric: true,
    },
  })
  if (!songData)
    return null

  const result = {
    ...songData,
    alias: songData.alias?.split(',') ?? [],
    artists: songData.artists.map(artist => ({
      id: artist.artist.id,
      name: artist.artist.name,
    })),
  }
  return result
}

// 获取某个歌曲的歌词
export async function getSongLyric(id: string) {
  const lyricData = await db.query.lyrics.findFirst({
    where: eq(lyrics.songId, Number(id)),
  })

  if (!lyricData)
    return null

  return lyricFormatter(lyricData.lyrics ?? '', lyricData.translation)
}

// 获取某个歌曲的播放链接（网易云）
export async function getSongUrl(id: string) {
  const songData = await getSongDetail(id)
  if (!songData)
    return null

  const url = await getSongUrlSimple({
    id: songData.sourceId,
    level: 'standard',
    cookie: USER_COOKIE,
  })
  return ensureHttps(url ?? '')
}

// 搜索歌曲
export async function searchSongs(keyword: string | null, page: number, pageSize: number) {
  if (!keyword)
    return []

  const trimmed = keyword.trim()
  if (!trimmed)
    return []

  const safePage = Number.isFinite(page) && page > 0 ? page : 1
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 50
  const offset = (safePage - 1) * safePageSize

  const pattern = `%${trimmed}%`

  // 1. 拿到歌曲 ID 列表
  const idRows = await db
    .select({ id: songs.id })
    .from(songs)
    .leftJoin(albums, eq(songs.albumId, albums.id))
    .leftJoin(songsToArtists, eq(songs.id, songsToArtists.songId))
    .leftJoin(artists, eq(songsToArtists.artistId, artists.id))
    .where(or(
      like(songs.name, pattern),
      like(songs.alias, pattern),
      like(albums.name, pattern),
      like(artists.name, pattern),
    ))
    .groupBy(songs.id)
    .orderBy(desc(songs.id))
    .offset(offset)
    .limit(safePageSize)

  const ids = idRows.map(r => r.id)
  if (ids.length === 0)
    return []

  // 2. 根据 id 查数据
  const songsData = await db.query.songs.findMany({
    where: inArray(songs.id, ids),
    with: {
      album: true,
      artists: {
        with: {
          artist: true,
        },
      },
    },
    orderBy: [desc(songs.id)],
  })

  const result = songsData.map(song => ({
    ...song,
    alias: song.alias?.split(',') ?? [],
    artists: song.artists.map(artist => ({
      id: artist.artist.id,
      name: artist.artist.name,
    })),
  }))
  return result
}

// 获取搜索歌曲总数
export async function getSearchSongCount(keyword: string | null) {
  if (!keyword)
    return 0

  const trimmed = keyword.trim()
  if (!trimmed)
    return 0

  const pattern = `%${trimmed}%`

  const rows = await db
    .select({ count: sql<number>`count(distinct ${songs.id})` })
    .from(songs)
    .leftJoin(albums, eq(songs.albumId, albums.id))
    .leftJoin(songsToArtists, eq(songs.id, songsToArtists.songId))
    .leftJoin(artists, eq(songsToArtists.artistId, artists.id))
    .where(or(
      like(songs.name, pattern),
      like(songs.alias, pattern),
      like(albums.name, pattern),
      like(artists.name, pattern),
    ))

  return rows[0]?.count ?? 0
}
