import type { StyleItem } from './style'

export interface SongItem {
  id: number
  name: number
  artist: string[]
  cover: string | null
  styles: StyleItem[]
  duration: number
  createdAt: string
  updatedAt: string
}
