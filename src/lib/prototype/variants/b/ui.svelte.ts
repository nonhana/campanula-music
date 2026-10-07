// PROTOTYPE · 变体 B 自己的界面状态（菜单、歌词开关、手机歌词模式、红心覆盖、轻提示）。
import type { Song } from '$lib/prototype/data'
import { player } from '$lib/prototype/player.svelte'

/** 曲库之外、左侧导航里的两个入口；不进 URL */
export type SpecialView = 'daily' | 'downloads' | null

export interface MenuState {
  song: Song
  x: number
  y: number
}

class VariantUi {
  special = $state<SpecialView>(null)
  menu = $state<MenuState | null>(null)
  /** 曲库列表里的搜索框是否展开 */
  searchOpen = $state(false)
  showTranslation = $state(true)
  showRomaji = $state(false)
  /** 手机播放页：歌词铺满全屏 */
  lyricsMode = $state(false)
  /** 原型里的红心改动 */
  hearts = $state<Record<string, boolean>>({})
  toast = $state('')
  private toastTimer: ReturnType<typeof setTimeout> | undefined

  liked(song: Song): boolean {
    return this.hearts[song.id] ?? song.liked
  }

  openMenu(song: Song, x: number, y: number) {
    this.menu = { song, x, y }
  }

  closeMenu() {
    this.menu = null
  }

  say(text: string) {
    this.toast = text
    clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => {
      this.toast = ''
    }, 2200)
  }

  toggleHeart(song: Song) {
    const next = !this.liked(song)
    this.hearts[song.id] = next
    this.say(next ? '已红心' : '已取消红心')
  }

  playNext(song: Song) {
    player.playNext(song)
    this.say('已设为下一首播放')
  }

  enqueue(song: Song) {
    player.enqueue(song)
    this.say('已加入播放队列')
  }
}

export const ui = new VariantUi()

/** 本地即时过滤：歌名、歌手、专辑 */
export function filterSongs(songs: Song[], query: string): Song[] {
  const q = query.trim().toLowerCase()
  if (!q)
    return songs
  return songs.filter(s =>
    s.title.toLowerCase().includes(q)
    || s.album.toLowerCase().includes(q)
    || s.artists.some(a => a.toLowerCase().includes(q)),
  )
}

/** 列表里第一首能播的歌 */
export function firstPlayable(songs: Song[]): number {
  const i = songs.findIndex(s => !s.unavailable)
  return Math.max(0, i)
}
