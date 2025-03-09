import type { SongItem } from '$lib/types'
import type { Song } from '../types'
import { db } from '$lib/server/db'
import { eq, inArray } from 'drizzle-orm'
import { album, artist, songArtists } from '../db/schema'

export async function songsFormatter(songsData: Song[]): Promise<SongItem[]> {
  if (songsData.length === 0)
    return []

  const songIds = songsData.map(s => s.id)

  const artistRelations = await db.query.songArtists.findMany({
    where: inArray(songArtists.songId, songIds),
  })

  const artistIds = [...new Set(artistRelations.map(rel => rel.artistId))]

  const artistsData = artistIds.length > 0
    ? await db.query.artist.findMany({
      where: inArray(artist.id, artistIds),
    })
    : []

  const artistsMap = new Map()
  artistsData.forEach((a) => {
    if (a && a.id !== undefined) {
      artistsMap.set(a.id, {
        id: a.id,
        name: a.name || '',
      })
    }
  })

  const albumIds = songsData
    .filter(s => s.albumId !== null)
    .map(s => s.albumId!)

  const albumsData = albumIds.length > 0
    ? await db.query.album.findMany({
      where: inArray(album.id, albumIds),
    })
    : []

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

export async function songItemFormatter(songData: Song | undefined): Promise<SongItem | null> {
  if (!songData)
    return null

  const artistRelations = await db.query.songArtists.findMany({
    where: eq(songArtists.songId, songData.id),
  })

  const artistIds = artistRelations.map(rel => rel.artistId)

  const artistsData = artistIds.length > 0
    ? await db.query.artist.findMany({
      where: inArray(artist.id, artistIds),
    })
    : []

  const artists = artistsData.map(a => ({
    id: a.id,
    name: a.name || '',
  }))

  let albumData = null
  if (songData.albumId) {
    albumData = await db.query.album.findFirst({
      where: eq(album.id, songData.albumId),
    })
  }

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
