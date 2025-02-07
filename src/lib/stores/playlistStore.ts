import type { SongItem } from '$lib/types'
import { writable } from 'svelte/store'

export const playlist = writable<SongItem[]>([])

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
