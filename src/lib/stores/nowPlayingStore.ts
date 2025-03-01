import type { LyricItem, SongItem } from '$lib/types'
import { mockLyrics } from '$lib/mock'
import { writable } from 'svelte/store'
import { addSongToPlaylist } from './playlistStore'

type PlayMode = 'repeat' | 'shuffle' | 'repeat1' | 'list'

/** 正在播放的歌曲 */
export const nowPlaying = writable<SongItem & { lyrics: LyricItem[] } | null>(null)
/** 当前播放时间 */
export const currentTime = writable(0)
/** 是否正在拖动进度条 */
export const seeking = writable(false)
/** 是否暂停 */
export const paused = writable(true)
/** 播放模式 */
export const playMode = writable<PlayMode>('list')
/** 音量 */
export const volume = writable(0.0)
/** 是否静音 */
export const muted = writable(false)

export async function getLyrics(song: SongItem): Promise<LyricItem[]> {
  // TODO: fetch lyrics from API
  return new Promise(
    (res) => {
      setTimeout(() => {
        res(mockLyrics(song.duration))
      }, 1000)
    },
  )
}
export function reset() {
  nowPlaying.set(null)
  currentTime.set(0)
  setSeeking(false)
  setPaused(true)
}
export function setNowPlaying(info: SongItem, lyrics: LyricItem[]) {
  reset()
  nowPlaying.set({ ...info, lyrics })
}
export async function addToPlaylistAndPlay(song: SongItem) {
  await addSongToPlaylist(song, false)
  const lyrics = await getLyrics(song)
  setNowPlaying(song, lyrics)
}
export function setCurrentTime(time: number) {
  currentTime.set(time)
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
