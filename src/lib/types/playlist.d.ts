import type { SongItem } from './song'
import type { StyleItem } from './style'

export interface PlaylistItem {
  id: number
  name: string
  description: string
  cover: string | null
  musicCount: number
}

export interface PlaylistDetail extends PlaylistItem {
  songs: SongItem[]
  styles: StyleItem[]
  createdAt: string
  updatedAt: string
}
