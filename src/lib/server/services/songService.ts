import type { SongItem } from '$lib/types'
import { db } from '$lib/server/db'
import { lyricFormatter } from '$lib/server/utils/lyricFormatter'
import { count, eq } from 'drizzle-orm'
import netease from 'NeteaseCloudMusicApi'
import { lyrics, song } from '../db/schema'
import { songItemFormatter, songsFormatter } from '../utils/songsFormatter'

// 获取数据库中歌曲总数
export async function getSongCount() {
  const result = await db.select({ count: count() }).from(song)
  return result[0].count
}

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

// 获取某个歌曲的播放链接（网易云）
export async function getSongUrl(id: string) {
  const songData = await getSongDetail(id)
  if (!songData)
    return null

  const res = await netease.song_url_v1({
    id: songData.sourceId,
    level: 'exhigh' as netease.SoundQualityType, // 默认较高音质
  })
  const data = res.body.data as { url: string, [key: string]: any }[]
  return data[0].url
}
