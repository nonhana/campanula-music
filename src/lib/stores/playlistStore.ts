import type { SongItem } from '$lib/types'
import { derived, writable } from 'svelte/store'

export const playlist = writable<SongItem[]>([])

// 使用 derived store 维护 ID 集合
export const playlistIdSet = derived(playlist, ($playlist) => {
  return new Set<number>($playlist.map(song => song.id))
})

export function clearPlaylist() {
  playlist.set([])
}

export function setPlaylist(songs: SongItem[]) {
  playlist.set(songs) // 直接 set，无需 clearPlaylist()
}

export function addSongToPlaylist(song: SongItem, throwError: boolean = true): Promise<void> {
  return new Promise((res, rej) => {
    let alreadyExists = false

    playlist.update((songs) => {
      if (songs.some(s => s.id === song.id)) {
        alreadyExists = true
        return songs
      }
      return [...songs, song]
    })

    if (alreadyExists) {
      throwError ? rej(new Error('已添加相同歌曲')) : res()
    }
    else {
      res()
    }
  })
}

export function removeSongFromPlaylist(id: number) {
  playlist.update((songs) => {
    return songs.some(s => s.id === id) ? songs.filter(s => s.id !== id) : songs
  })
}

export function isSongInPlaylist(id: number) {
  let exists = false
  playlistIdSet.subscribe(set => exists = set.has(id))()
  return exists
}
