import type { LyricItem, SongItem } from '$lib/types'
import { mockLyrics } from '$lib/mock'
import { writable } from 'svelte/store'
import { addSongToPlaylist } from './playlistStore'

type PlayMode = 'repeat' | 'shuffle' | 'repeat1' | 'list'

export const nowPlaying = writable<SongItem & { lyrics: LyricItem[] } | null>(null)
export const currentTime = writable(0)
export const playMode = writable<PlayMode>('list')
export const volume = writable(0.0)
export const muted = writable(false)
export const seeking = writable(false)
export const paused = writable(true)

export function getLyrics(song: SongItem): LyricItem[] {
  // TODO: fetch lyrics from API
  return mockLyrics(song.duration)
}
export function setNowPlaying(info: SongItem, lyrics: LyricItem[]) {
  nowPlaying.set({ ...info, lyrics })
}
export async function addToPlaylistAndPlay(song: SongItem) {
  await addSongToPlaylist(song)
  setNowPlaying(song, getLyrics(song))
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
export function reset() {
  nowPlaying.set(null)
  currentTime.set(0)
}
