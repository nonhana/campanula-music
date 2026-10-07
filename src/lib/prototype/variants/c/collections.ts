// PROTOTYPE（变体 C）：歌单页可以打开的“一份列表”。歌单之外，专辑、歌手、每日推荐、已下载也用同一个页面，
// 搜索框随之限定在这份列表里。
import type { PlaySource } from '$lib/prototype/player.svelte'
import type { Song } from '$lib/prototype/data'
import { albums, artists, daily, formatCount, likedDownloaded, likedSongs, playlists, songsOf } from '$lib/prototype/data'

export interface Collection {
  id: string
  kind: 'liked' | 'own' | 'collected' | 'album' | 'artist' | 'daily' | 'downloads'
  name: string
  cover: string
  /** 头像是圆的（歌手） */
  round?: boolean
  songs: Song[]
  downloaded: number
  /** 名称下面的一行元信息 */
  meta: string[]
  description: string
  source: PlaySource
}

export const downloadedSongs = likedSongs.filter(s => s.download === 'done')

export const playableSongs = likedSongs.filter(s => !s.unavailable)

export type SongFilter = 'all' | 'downloaded' | 'playable'

export function applyFilter(list: Song[], f: SongFilter): Song[] {
  if (f === 'downloaded')
    return list.filter(s => s.download === 'done')
  if (f === 'playable')
    return list.filter(s => !s.unavailable)
  return list
}

function countDone(list: Song[]) {
  return list.filter(s => s.download === 'done').length
}

export function collectionOf(id: string): Collection {
  if (id === 'daily') {
    return {
      id,
      kind: 'daily',
      name: '每日推荐',
      cover: daily.songs[0].cover,
      songs: daily.songs,
      downloaded: countDone(daily.songs),
      meta: [`${daily.dateLabel} ${daily.weekday}`, `${daily.songs.length} 首`, '每天 6:00 更新'],
      description: '',
      source: { kind: 'daily', name: '每日推荐', id: 'daily' },
    }
  }
  if (id === 'downloads') {
    return {
      id,
      kind: 'downloads',
      name: '已下载',
      cover: downloadedSongs[1]?.cover ?? likedSongs[0].cover,
      songs: downloadedSongs,
      downloaded: downloadedSongs.length,
      meta: ['保存在这台设备上', `${formatCount(downloadedSongs.length)} 首`, '不需要联网也能播放'],
      description: '',
      source: { kind: 'downloads', name: '已下载', id: 'downloads' },
    }
  }
  const album = albums.find(a => a.id === id)
  if (album) {
    const songs = likedSongs.filter(s => s.album === album.name).slice(0, 400)
    return {
      id,
      kind: 'album',
      name: album.name,
      cover: album.cover,
      songs,
      downloaded: countDone(songs),
      meta: [album.artist, String(album.year), `曲库中 ${formatCount(songs.length)} 首`],
      description: album.description,
      source: { kind: 'album', name: album.name, id },
    }
  }
  const artist = artists.find(a => a.id === id)
  if (artist) {
    const songs = likedSongs.filter(s => s.artists.includes(artist.name))
    return {
      id,
      kind: 'artist',
      name: artist.name,
      cover: artist.avatar,
      round: true,
      songs,
      downloaded: countDone(songs),
      meta: ['歌手', `我喜欢的音乐中 ${formatCount(songs.length)} 首`],
      description: '',
      source: { kind: 'playlist', name: artist.name, id },
    }
  }
  const pl = playlists.find(p => p.id === id) ?? playlists[0]
  const songs = songsOf(pl.id)
  const [, m, d] = pl.updatedAt.split('-').map(Number)
  const updated = `${m}月${d}日`
  return {
    id: pl.id,
    kind: pl.kind,
    name: pl.name,
    cover: pl.cover,
    songs,
    downloaded: pl.kind === 'liked' ? likedDownloaded : pl.downloaded,
    meta: [pl.creator, `${formatCount(pl.count)} 首`, `更新于 ${updated}`],
    description: pl.description,
    source: pl.kind === 'liked'
      ? { kind: 'liked', name: '我喜欢的音乐', id: 'liked' }
      : { kind: 'playlist', name: pl.name, id: pl.id },
  }
}
