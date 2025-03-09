import type { SongItem } from '$lib/types'
import { db } from '$lib/server/db'
import { lyricFormatter } from '$lib/server/utils/lyricFormatter'
import { eq, inArray } from 'drizzle-orm'
import { album, artist, lyrics, song, songArtists } from '../db/schema'

// 分页获取歌曲列表
export async function getSongList(page: number, pageSize: number) {
  // 1. 获取基础歌曲信息（带分页）
  const songsData = await db.query.song.findMany({
    offset: (page - 1) * pageSize,
    limit: pageSize,
  })

  if (songsData.length === 0)
    return []

  // 提取歌曲ID，用于后续批量查询
  const songIds = songsData.map(s => s.id)

  // 2. 批量查询所有相关的艺术家关系和艺术家信息
  // 获取艺术家关系
  const artistRelations = await db.query.songArtists.findMany({
    where: inArray(songArtists.songId, songIds),
  })

  // 获取所有相关艺术家的ID
  const artistIds = [...new Set(artistRelations.map(rel => rel.artistId))]

  // 批量获取艺术家详情
  const artistsData = artistIds.length > 0
    ? await db.query.artist.findMany({
      where: inArray(artist.id, artistIds),
    })
    : []

  // 创建艺术家映射表，方便后续查找
  const artistsMap = new Map()
  artistsData.forEach((a) => {
    if (a && a.id !== undefined) {
      artistsMap.set(a.id, {
        id: a.id,
        name: a.name || '',
      })
    }
  })

  // 3. 批量查询所有相关的专辑
  const albumIds = songsData
    .filter(s => s.albumId !== null)
    .map(s => s.albumId!)

  const albumsData = albumIds.length > 0
    ? await db.query.album.findMany({
      where: inArray(album.id, albumIds),
    })
    : []

  // 创建专辑映射表，方便后续查找
  const albumsMap = new Map()
  albumsData.forEach((a) => {
    if (a && a.id !== undefined) {
      albumsMap.set(a.id, {
        id: a.id,
        name: a.name || '',
        cover: a.cover || '',
      })
    }
  })

  // 创建歌曲-艺术家关系映射
  const songToArtistsMap = new Map()
  artistRelations.forEach((rel) => {
    const songId = rel.songId
    const artistId = rel.artistId

    if (!songToArtistsMap.has(songId)) {
      songToArtistsMap.set(songId, [])
    }

    const artistInfo = artistsMap.get(artistId)
    if (artistInfo) {
      songToArtistsMap.get(songId).push(artistInfo)
    }
  })

  // 4. 构建结果
  const result: SongItem[] = songsData.map((songItem) => {
    const songId = songItem.id
    const albumId = songItem.albumId

    return {
      id: songId,
      name: songItem.name || '',
      alias: songItem.alias ? songItem.alias.split(',') : [],
      artists: songToArtistsMap.get(songId) || [],
      album: albumId && albumsMap.has(albumId)
        ? albumsMap.get(albumId)
        : {
            id: 0,
            name: '',
            cover: '',
          },
      duration: songItem.duration || 0,
      source: songItem.source || '',
      sourceId: songItem.sourceId || '',
    }
  })

  return result
}

// 获取某个歌曲的详情信息
export async function getSongDetail(id: number): Promise<SongItem | null> {
  // 1. 获取歌曲基本信息
  const songData = await db.query.song.findFirst({
    where: eq(song.id, id),
  })

  if (!songData)
    return null

  // 2. 获取关联的艺术家关系
  const artistRelations = await db.query.songArtists.findMany({
    where: eq(songArtists.songId, id),
  })

  // 获取所有艺术家ID
  const artistIds = artistRelations.map(rel => rel.artistId)

  // 批量获取艺术家详情
  const artistsData = artistIds.length > 0
    ? await db.query.artist.findMany({
      where: inArray(artist.id, artistIds),
    })
    : []

  // 整理艺术家信息
  const artists = artistsData.map(a => ({
    id: a.id,
    name: a.name || '',
  }))

  // 3. 获取专辑信息
  let albumData = null
  if (songData.albumId) {
    albumData = await db.query.album.findFirst({
      where: eq(album.id, songData.albumId),
    })
  }

  // 4. 构建返回结果
  return {
    id: songData.id,
    name: songData.name || '',
    alias: songData.alias ? songData.alias.split(',') : [],
    artists,
    album: albumData
      ? {
          id: albumData.id,
          name: albumData.name || '',
          cover: albumData.cover || '',
        }
      : {
          id: 0,
          name: '',
          cover: '',
        },
    duration: songData.duration || 0,
    source: songData.source || '',
    sourceId: songData.sourceId || '',
  }
}

// 获取某个歌曲的歌词
export async function getSongLyric(id: number) {
  const lyricData = await db.query.lyrics.findFirst({
    where: eq(lyrics.songId, id),
  })

  if (!lyricData)
    return null

  return lyricFormatter(lyricData.lyrics ?? '', lyricData.translation)
}
