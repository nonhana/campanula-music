import type { SongItem } from './types/song'

export const mockSongs: SongItem[] = Array.from({ length: 312 }).map((_, index) => ({
  id: index,
  name: `Song ${index}`,
  artist: ['Artist1', 'Artist2'],
  cover: 'https://moe.greyflowers.pics/avatar.webp',
  styles: [],
  duration: 60,
}))
