import type { SongItem } from '$lib/types'
import { writable } from 'svelte/store'

type PlayMode = 'repeat' | 'shuffle' | 'repeat1' | 'list'

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
export const playMode = writable<PlayMode>('list')
export const volume = writable(0.0)
export const muted = writable(false)
export const seeking = writable(false)
export const paused = writable(false)

export function setNowPlaying(song: SongItem | null) {
  nowPlaying.set(song)
}
export function clearNowPlaying() {
  nowPlaying.set(null)
}
export function setPlayMode(mode: PlayMode) {
  playMode.set(mode)
}
export function mute() {
  muted.update(v => !v)
}
export function setSeeking(value: boolean) {
  seeking.set(value)
}
export function setPaused(value: boolean) {
  paused.set(value)
}
