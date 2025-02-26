import type { SongItem } from './song'

export interface PlaylistItem {
  id: number
  name: string
  description: string
  cover: string | null
  musicCount: number
}

export interface PlaylistDetail extends PlaylistItem {
  songs: SongItem[]
}
