import type { LyricItem, SongItem } from '$lib/types'
import { writable } from 'svelte/store'
import { addSongToPlaylist } from './playlistStore'

type PlayMode = 'repeat' | 'shuffle' | 'repeat1' | 'list'

/** 正在加载 */
export const songLoading = writable(false)
/** 正在播放的歌曲 */
export const nowPlaying = writable<SongItem & { lyrics: LyricItem[] } | null>(null)
/** 当前正在播放的歌曲的 url */
export const nowPlayingUrl = writable<string | null>(null)
/** 当前播放时间，单位：秒 */
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

// 设置歌曲加载状态
export function setSongLoading(value: boolean) {
  songLoading.set(value)
}
// 重置歌曲播放状态
export function reset() {
  nowPlaying.set(null)
  nowPlayingUrl.set(null)
  currentTime.set(0)
  setSeeking(false)
  setPaused(true)
}
// 获取歌曲 url
export async function getSongUrl(song: SongItem): Promise<string> {
  const res = await fetch(`/api/songs/${song.id}/url`)
  const data = await res.json()
  return data
}
// 获取歌词
export async function getLyrics(song: SongItem): Promise<LyricItem[]> {
  const res = await fetch(`/api/songs/${song.id}/lyrics`)
  const data = await res.json()
  return data
}
// 设置当前播放的歌曲
export async function setNowPlaying(song: SongItem) {
  setSongLoading(true)
  const lyrics = await getLyrics(song)
  reset()
  nowPlaying.set({ ...song, lyrics })
  const source = await getSongUrl(song)
  nowPlayingUrl.set(source)
}
// 添加到播放列表并立即播放
export async function addToPlaylistAndPlay(song: SongItem) {
  setSongLoading(true)
  await addSongToPlaylist(song, false)
  await setNowPlaying(song)
}
// 设置当前播放时间
export function setCurrentTime(time: number) {
  currentTime.set(time)
}
// 设置播放模式
export function setPlayMode(mode: PlayMode) {
  playMode.set(mode)
}
// 静音
export function mute() {
  muted.update(v => !v)
}
// 设置是否正在拖动进度条
export function setSeeking(value: boolean) {
  seeking.set(value)
}
// 设置是否暂停
export function setPaused(value: boolean) {
  paused.set(value)
}
