import type { SongItem } from '$lib/types'
import { writable } from 'svelte/store'

export const nowPlaying = writable<SongItem | null>({
  id: 0,
  name: `Song ${0}`,
  alias: ['Alias1', 'Alias2'],
  artists: ['Artist1', 'Artist2'],
  cover: 'https://moe.greyflowers.pics/avatar.webp',
  album: 'Album',
  duration: 274,
  source: 'https://moe.greyflowers.pics/Windy_Hill.mp3',
})

export function setNowPlaying(song: SongItem | null) {
  nowPlaying.set(song)
}

export function clearNowPlaying() {
  nowPlaying.set(null)
}
