import type { SongItem } from '$lib/types'
import { db } from '$lib/server/db'
import { lyricFormatter } from '$lib/server/utils/lyricFormatter'
import { eq } from 'drizzle-orm'
import { lyrics, song } from '../db/schema'
import { songItemFormatter, songsFormatter } from '../utils/songsFormatter'

// 分页获取歌曲列表
export async function getSongList(page: number, pageSize: number) {
  const songsData = await db.query.song.findMany({
    offset: (page - 1) * pageSize,
    limit: pageSize,
  })
  const result = await songsFormatter(songsData)
  return result
}

// 获取某个歌曲的详情信息
export async function getSongDetail(id: string): Promise<SongItem | null> {
  const songData = await db.query.song.findFirst({
    where: eq(song.id, Number(id)),
  })
  const result = await songItemFormatter(songData)
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
