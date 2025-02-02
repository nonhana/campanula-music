import type { PlaylistItem, SongItem } from './types'

export const mockSongs: SongItem[] = Array.from({ length: 312 }).map((_, index) => ({
  id: index,
  name: `Song ${index}`,
  artist: ['Artist1', 'Artist2'],
  cover: 'https://moe.greyflowers.pics/avatar.webp',
  styles: [],
  duration: 60,
}))

export const mockPlaylists: PlaylistItem[] = Array.from({ length: 21 }).map((_, index) => ({
  id: index,
  name: `Playlist ${index}`,
  description: 'Description',
  cover: 'https://moe.greyflowers.pics/avatar.webp',
  musicCount: 10,
}))
