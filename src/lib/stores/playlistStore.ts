import type { PlaylistItem, SongItem } from '$lib/types'
import { derived, get, writable } from 'svelte/store'

/** 歌单 ID（如果是从一个歌单添加的播放列表，则记录歌单 ID） */
export const playlistId = writable<string | null>(null)
/** 存储的歌单列表 */
export const storedPlaylists = writable<PlaylistItem[]>([])

export function setPlaylistId(id: string) {
  playlistId.set(id)
}

export const playlist = writable<SongItem[]>([])

export const playlistIdSet = derived(playlist, ($playlist) => {
  return new Set<number>($playlist.map(song => song.id))
})

export function resetPlaylist() {
  playlist.set([])
  playlistId.set(null)
}

/**
 * 将指定歌曲列表更新到当前播放列表，返回是否发生了变更。
 * svelte 的 safe_not_equal 对对象恒真：update 回调即使返回原引用，订阅者也会被广播；
 * 因此不走 update 的闭包回传，显式比较后仅在真实变更时 set
 */
export function updatePlaylist(songs: SongItem[]): boolean {
  const current = get(playlist)
  if (current.length !== songs.length) {
    playlist.set(songs)
    return true
  }

  let hasChanged = false
  const newList = [...current]
  for (let i = 0; i < songs.length; i++) {
    if (current[i].id !== songs[i].id) {
      newList[i] = songs[i]
      hasChanged = true
    }
  }

  if (hasChanged)
    playlist.set(newList)
  return hasChanged
}

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
