import type { PlaylistItem } from '$lib/types'
import { db } from '$lib/server/db'
import { eq } from 'drizzle-orm'
import { playlists } from '../db/schema'
import { songsFormatter } from '../utils/songsFormatter'

// 获取全部的歌单列表
export async function getAllPlaylists() {
  const playlistsData = await db.query.playlists.findMany()
  const result: PlaylistItem[] = playlistsData.map(p => ({
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
  const result = await db.query.playlists.findFirst({
    where: eq(playlists.id, Number(id)),
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
  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, Number(id)),
    with: {
      songs: {
        with: {
          song: {
            with: {
              album: true,
              artists: {
                with: {
                  artist: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!playlist) {
    return []
  }

  // 提取歌曲数据并格式化
  const songsList = playlist.songs.map(relation => relation.song)
  const result = await songsFormatter(songsList)
  return result
}
