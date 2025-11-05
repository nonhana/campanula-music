import type { PlaylistItem, SongItem } from '$lib/types'
import { derived, writable } from 'svelte/store'

/** 歌单 ID（如果是从一个歌单添加的播放列表，则记录歌单 ID） */
export const playlistId = writable<string | null>(null)
/** 存储的歌单列表 */
export const storedPlaylists = writable<PlaylistItem[]>([])

// 设置歌单 ID
export function setPlaylistId(id: string) {
  playlistId.set(id)
}

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

// 重置状态
export function resetPlaylist() {
  playlist.set([])
  playlistId.set(null)
}

// 设置播放列表
export function setPlaylist(songs: SongItem[]): boolean {
  let hasChanged = false

  playlist.update((current) => {
    const len = songs.length
    if (len !== current.length) {
      hasChanged = true
      return songs
    }

    const newList = [...current]
    for (let i = 0; i < len; i++) {
      const newSong = songs[i]
      const oldSong = current[i]
      if (oldSong?.id !== newSong.id) {
        newList[i] = newSong
        hasChanged = true
      }
    }

    return hasChanged ? newList : current
  })

  return hasChanged
}

// 添加歌曲到播放列表
export function addSongToPlaylist(song: SongItem) {
  playlist.update((songs) => {
    const existingIndex = songs.findIndex(s => s.id === song.id)
    if (existingIndex !== -1) {
      const newSongs = [...songs]
      const [existingSong] = newSongs.splice(existingIndex, 1)
      return [existingSong, ...newSongs]
    }
    return [...songs, song]
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
