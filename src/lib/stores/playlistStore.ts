import type { SongItem } from '$lib/types'
import { writable } from 'svelte/store'

export const playlist = writable<SongItem[]>([])

export function clearPlaylist() {
  playlist.set([])
}
export function setPlaylist(songs: SongItem[]) {
  clearPlaylist()
  playlist.set(songs)
}
export function addSongToPlaylist(song: SongItem, throwError: boolean = true): Promise<void> {
  return new Promise((res, rej) => {
    playlist.update((songs) => {
      if (songs.some(s => s.id === song.id)) {
        if (throwError) {
          rej(new Error('已添加相同歌曲'))
        }
        else {
          res()
        }
        return songs
      }
      res()
      return [...songs, song]
    })
  })
}
export function removeSongFromPlaylist(id: number) {
  playlist.update(songs => songs.filter(s => s.id !== id))
}

const playlistIdSet = new Set<number>()
playlist.subscribe((value) => {
  playlistIdSet.clear()
  value.forEach(song => playlistIdSet.add(song.id))
})

export function isSongInPlaylist(id: number) {
  return playlistIdSet.has(id)
}
