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

  playlist.update((currentPlaylist) => {
    // 创建当前播放列表的ID映射，用于快速查找
    const currentSongsMap = new Map<number, SongItem>()
    currentPlaylist.forEach((song) => {
      currentSongsMap.set(song.id, song)
    })

    // 使用Diff算法构建新的播放列表
    const newPlaylist = songs.map((newSong) => {
      // 如果新歌曲在当前播放列表中已存在，保留原引用以保持状态
      const existingSong = currentSongsMap.get(newSong.id)
      if (existingSong) {
        return existingSong // 复用已有的对象引用
      }
      return newSong // 添加新歌曲
    })

    // 只有当播放列表确实发生变化时才更新
    if (
      newPlaylist.length !== currentPlaylist.length
      || newPlaylist.some((song, index) => song.id !== currentPlaylist[index]?.id)
    ) {
      hasChanged = true
      return newPlaylist
    }

    return currentPlaylist // 如果没有变化，返回原播放列表
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
