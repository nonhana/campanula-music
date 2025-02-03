import type { StyleItem } from './style'

export interface SongItem {
  id: number
  name: string
  alias: string[]
  artists: string[]
  cover: string | null
  album: string
  duration: number
}

export interface SongDetail extends SongItem {
  styles: StyleItem[]
  lyrics: string
  releaseDate: string
}
