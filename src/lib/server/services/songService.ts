import type { SongItem } from '$lib/types'
import { db } from '$lib/server/db'
import { lyricFormatter } from '$lib/server/utils/lyricFormatter'
import { count, eq } from 'drizzle-orm'
import netease from 'NeteaseCloudMusicApi'
import { lyrics, songs } from '../db/schema'

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
  })
  const result = songsData.map(song => ({
    ...song,
    alias: song.alias.split(','),
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
    alias: songData.alias.split(','),
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

  const res = await netease.song_url_v1({
    id: songData.sourceId,
    level: 'exhigh' as netease.SoundQualityType, // 默认较高音质
  })
  const data = res.body.data as { url: string, [key: string]: any }[]
  return data[0].url
}
