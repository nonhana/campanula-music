import type { SongItem } from '$lib/types'
import { writable } from 'svelte/store'

export const playlist = writable<SongItem[]>([])

export function setPlaylist(songs: SongItem[]) {
  playlist.set(songs)
}

export function clearPlaylist() {
  playlist.set([])
}

export function addSongToPlaylist(song: SongItem): Promise<void> {
  return new Promise((res, rej) => {
    playlist.update((songs) => {
      if (songs.some(s => s.id === song.id)) {
        rej(new Error('已添加相同歌曲'))
        return songs
      }
      res()
      return [...songs, song]
    })
  })
}

export function removeSongFromPlaylist(song: SongItem) {
  playlist.update(songs => songs.filter(s => s.id !== song.id))
}
