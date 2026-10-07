// PROTOTYPE（变体 C）：即时搜索的结果分组，以及每一项被选中时做什么。桌面下拉面板和手机全屏搜索共用。
import type { Artist, Playlist, Song } from '$lib/prototype/data'
import { artists, likedSongs, playlists } from '$lib/prototype/data'
import { nav } from '$lib/prototype/nav.svelte'
import { player } from '$lib/prototype/player.svelte'
import { filterArtists, filterPlaylists, filterSongs } from './search'
import { ui } from './ui.svelte'

export type ResultItem =
  | { kind: 'song', song: Song, index: number }
  | { kind: 'playlist', playlist: Playlist }
  | { kind: 'artist', artist: Artist }
  | { kind: 'cloud' }
  | { kind: 'all' }

export interface Results {
  query: string
  songs: Song[]
  playlists: Playlist[]
  artists: Artist[]
  /** 键盘上下移动的顺序 */
  items: ResultItem[]
}

export const TOP_SONGS = 5

export function buildResults(query: string): Results {
  const songs = filterSongs(likedSongs, query)
  const pls = filterPlaylists(playlists, query)
  const ars = filterArtists(artists, query)
  const items: ResultItem[] = [
    ...songs.slice(0, TOP_SONGS).map((song, index) => ({ kind: 'song' as const, song, index })),
    ...pls.map(playlist => ({ kind: 'playlist' as const, playlist })),
    ...ars.map(artist => ({ kind: 'artist' as const, artist })),
    { kind: 'cloud' },
  ]
  if (songs.length > 0)
    items.push({ kind: 'all' })
  return { query, songs, playlists: pls, artists: ars, items }
}

export function itemKey(item: ResultItem): string {
  switch (item.kind) {
    case 'song': return `song-${item.song.id}`
    case 'playlist': return `pl-${item.playlist.id}`
    case 'artist': return `ar-${item.artist.id}`
    default: return item.kind
  }
}

/** 选中一项。返回 true 表示搜索界面应当收起 */
export function activate(item: ResultItem, results: Results): boolean {
  const q = results.query.trim()
  ui.remember(q)
  switch (item.kind) {
    case 'song':
      player.playFrom(results.songs, item.index, { kind: 'liked', name: `曲库中的“${q}”`, id: 'liked' })
      return false
    case 'playlist':
      nav.query = ''
      nav.openPlaylist(item.playlist.id)
      return true
    case 'artist':
      nav.query = ''
      nav.openPlaylist(item.artist.id)
      return true
    case 'all':
      // 保留搜索词，进入我喜欢的音乐并就地过滤
      nav.openPlaylist('liked')
      return true
    case 'cloud':
      // 原型：网易云搜索结果页不在本轮范围内
      return false
  }
}
