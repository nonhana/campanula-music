import type { StyleItem } from './style'

export interface SongItem {
  id: number
  name: string
  artist: string[]
  cover: string | null
  styles: StyleItem[]
  duration: number
}
