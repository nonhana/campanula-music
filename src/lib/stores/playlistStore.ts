import type { PlaylistItem, SongItem } from '$lib/types'
import { derived, writable } from 'svelte/store'

export const storedPlaylists = writable<PlaylistItem[]>([])

// 清空歌单列表
export function clearPlaylists() {
  storedPlaylists.set([])
}

// 设置歌单列表
export function setPlaylists(playlists: PlaylistItem[]) {
  storedPlaylists.set(playlists)
}

export const playlist = writable<SongItem[]>([])

// 使用 derived store 维护 ID 集合
export const playlistIdSet = derived(playlist, ($playlist) => {
  return new Set<number>($playlist.map(song => song.id))
})

// 清空播放列表
export function clearPlaylist() {
  playlist.set([])
}

// 设置播放列表
export function setPlaylist(songs: SongItem[]) {
  playlist.set(songs) // 直接 set，无需 clearPlaylist()
}

// 添加歌曲到播放列表
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

// 从播放列表中移除歌曲
export function removeSongFromPlaylist(id: number) {
  playlist.update((songs) => {
    return songs.some(s => s.id === id) ? songs.filter(s => s.id !== id) : songs
  })
}

// 判断歌曲是否在播放列表中
export function isSongInPlaylist(id: number) {
  let exists = false
  playlistIdSet.subscribe(set => exists = set.has(id))()
  return exists
}
