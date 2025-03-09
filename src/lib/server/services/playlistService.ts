import type { PlaylistItem } from '$lib/types'
import type { Song } from '../types'
import { db } from '$lib/server/db'
import { eq } from 'drizzle-orm'
import { playlist, playlistSong } from '../db/schema'
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
export async function getPlaylistById(id: number) {
  const result = await db.query.playlist.findFirst({
    where: eq(playlist.id, id),
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
export async function getPlaylistSongs(id: number) {
  const retrieved = await db.query.playlistSong.findMany({
    where: eq(playlistSong.playlistId, id),
    with: {
      song: true,
    },
  })
  const songs = retrieved.map(item => item.song) as Song[]
  const result = await songsFormatter(songs)
  return result
}
