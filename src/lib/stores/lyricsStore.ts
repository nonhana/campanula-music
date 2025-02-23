import type { LyricItem } from '$lib/types'
import { mockLyrics } from '$lib/mock'
import { writable } from 'svelte/store'

const lyrics = mockLyrics(274)

interface NowLyricsInfo {
  id: number
  lyrics: LyricItem[]
}

export const nowLyrics = writable<NowLyricsInfo | null>({
  id: 0,
  lyrics,
})
export const currentLyricIndex = writable(0)

export function setNowLyrics(id: number, lyrics: LyricItem[]) {
  nowLyrics.set({ id, lyrics })
}
export function setCurrentLyricIndex(index: number) {
  currentLyricIndex.set(index)
}
export function reset() {
  nowLyrics.set(null)
  currentLyricIndex.set(0)
}
