import type { PlaylistItem } from '$lib/types'
import { db } from '$lib/server/db'
import { eq, inArray } from 'drizzle-orm'
import { playlist, playlistSong, song } from '../db/schema'
import { songsFormatter } from '../utils/songsFormatter'

// 获取全部的歌单列表
export async function getAllPlaylists() {
  const playlists = await db.query.playlist.findMany()
  const result: PlaylistItem[] = playlists.map(p => ({
    id: p.id,
    name: p.name || '',
    description: p.description || '',
    cover: p.cover || '',
    musicCount: p.musicCount || 0,
    sourceId: p.sourceId || '',
  }))
  return result
}

// 获取某个歌单信息
export async function getPlaylistById(id: string) {
  const result = await db.query.playlist.findFirst({
    where: eq(playlist.id, Number(id)),
  })
  if (!result) {
    throw new Error('歌单不存在')
  }
  return {
    id: result.id,
    name: result.name || '',
    description: result.description || '',
    cover: result.cover || '',
    musicCount: result.musicCount || 0,
    sourceId: result.sourceId || '',
  } as PlaylistItem
}

// 获取某个歌单的歌曲列表
export async function getPlaylistSongs(id: string) {
  const relation = await db.query.playlistSong.findMany({
    where: eq(playlistSong.playlistId, Number(id)),
  })
  const songIds = relation.map(item => item.songId)
  const songs = await db.query.song.findMany({
    where: inArray(song.id, songIds),
  })
  const result = await songsFormatter(songs)
  return result
}
