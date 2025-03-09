import { db } from '$lib/server/db'
import { eq } from 'drizzle-orm'
import { playlist, playlistSong } from '../db/schema'

// 获取全部的歌单列表
export async function getAllPlaylists() {
  const playlists = await db.query.playlist.findMany()
  return playlists
}

// 获取某个歌单信息
export async function getPlaylistById(id: number) {
  const result = await db.query.playlist.findFirst({
    where: eq(playlist.id, id),
  })
  if (!result) {
    throw new Error('歌单不存在')
  }
  return result
}

// 获取某个歌单的歌曲列表
export async function getPlaylistSongs(id: number) {
  const result = await db.query.playlistSong.findMany({
    where: eq(playlistSong.playlistId, id),
    with: {
      song: true,
    },
  })
  return result
}
