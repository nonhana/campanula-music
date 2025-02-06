import type { SongItem } from '$lib/types'
import { writable } from 'svelte/store'

export const playlist = writable<SongItem[]>([])
export const shuffling = writable(false)
export const repeating = writable(false)

export function setPlaylist(songs: SongItem[]) {
  playlist.set(songs)
}

export function clearPlaylist() {
  playlist.set([])
}

export function addSongToPlaylist(song: SongItem) {
  playlist.update(songs => [...songs, song])
}

export function removeSongFromPlaylist(song: SongItem) {
  playlist.update(songs => songs.filter(s => s.id !== song.id))
}

export function shuffle() {
  shuffling.update(v => !v)
}

export function repeat() {
  repeating.update(v => !v)
}
