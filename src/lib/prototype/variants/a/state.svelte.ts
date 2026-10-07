// PROTOTYPE：变体 A 自己的界面状态（菜单、侧栏展开、红心切换）和几个播放小工具。
import type { Playlist, Song } from '$lib/prototype/data'
import type { PlaySource } from '$lib/prototype/player.svelte'
import { daily, likedSongs, playlists } from '$lib/prototype/data'
import { nav } from '$lib/prototype/nav.svelte'
import { player } from '$lib/prototype/player.svelte'
import { SvelteSet } from 'svelte/reactivity'

export type MenuContext = 'library' | 'downloads'

export interface MenuOptions {
  /** downloads = 已下载页：菜单里是“删除下载” */
  context?: MenuContext
  /** 菜单里的“播放”（未登录时的已下载页用） */
  onplay?: () => void
}

export interface MenuRequest extends Required<Pick<MenuOptions, 'context'>> {
  song: Song
  /** 菜单左上角的参考点（浮层用） */
  x: number
  y: number
  /** 关闭后把焦点还给它 */
  from: HTMLElement | null
  /** 手机布局下用底部弹层；鼠标右键打开时即使在窄窗口里也用浮层 */
  sheet: boolean
  onplay?: () => void
}

class VariantAUi {
  menu = $state.raw<MenuRequest | null>(null)
  railExpanded = $state(false)
  private unliked = new SvelteSet<string>()
  /** 原型里“删除下载”只在内存里记一下 */
  removed = new SvelteSet<string>()

  openMenu(song: Song, x: number, y: number, from: HTMLElement | null, sheet: boolean, opts: MenuOptions = {}) {
    this.menu = { song, x, y, from, sheet, context: opts.context ?? 'library', onplay: opts.onplay }
  }

  /** 从 ••• 按钮打开：桌面浮层贴着按钮，手机是底部弹层 */
  openMenuFrom(song: Song, el: HTMLElement, opts: MenuOptions = {}) {
    const r = el.getBoundingClientRect()
    this.openMenu(song, r.right, r.bottom + 4, el, true, opts)
  }

  /** 右键（或键盘的菜单键）打开。鼠标右键一律用浮层；触屏长按用底部弹层 */
  openMenuAt(song: Song, e: MouseEvent, opts: MenuOptions = {}) {
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    const touch = (e as PointerEvent).pointerType === 'touch'
    if (e.clientX === 0 && e.clientY === 0) {
      const r = el.getBoundingClientRect()
      this.openMenu(song, r.right - 48, r.top + r.height / 2, el, touch, opts)
    }
    else {
      this.openMenu(song, e.clientX, e.clientY, el, touch, opts)
    }
  }

  closeMenu() {
    const from = this.menu?.from
    this.menu = null
    from?.focus({ preventScroll: true })
  }

  /** 红心是网易云账号的数据：未登录时一律不显示 */
  isLiked(song: Song) {
    return !nav.loggedOut && song.liked && !this.unliked.has(song.id)
  }

  toggleLike(song: Song) {
    if (this.unliked.has(song.id))
      this.unliked.delete(song.id)
    else this.unliked.add(song.id)
  }
}

export const ui = new VariantAUi()

export const likedSource: PlaySource = { kind: 'liked', name: '我喜欢的音乐', id: 'liked' }
export const dailySource: PlaySource = { kind: 'daily', name: '每日推荐' }

export function sourceOf(pl: Playlist): PlaySource {
  return pl.id === 'liked' ? likedSource : { kind: 'playlist', name: pl.name, id: pl.id }
}

/** 这一行是不是正在播放的那一首：同一份列表按位置判断，别的列表按歌曲判断 */
export function isNow(list: Song[], i: number, song: Song): boolean {
  if (player.queue === list)
    return player.index === i
  return player.current?.id === song.id
}

export function playDaily() {
  player.playFrom(daily.songs, 0, dailySource)
}

export function shuffleLiked() {
  player.mode = 'shuffle'
  let i = Math.floor(Math.random() * likedSongs.length)
  while (likedSongs[i].unavailable)
    i = (i + 1) % likedSongs.length
  player.playFrom(likedSongs, i, likedSource)
}

/** 播放某张专辑：原型里从我喜欢的音乐里挑出这张专辑的歌 */
export function playAlbum(name: string) {
  const list = likedSongs.slice(0, 400).filter(s => s.album === name && !s.unavailable)
  if (list.length)
    player.playFrom(list, 0, { kind: 'album', name, id: name })
}

export const dailyDay = daily.dateLabel.match(/(\d+)月(\d+)日/)?.slice(1) ?? ['10', '7']

export const ownPlaylists = playlists.filter(p => p.kind === 'own')
export const collectedPlaylists = playlists.filter(p => p.kind === 'collected')

export type PlaylistFilter = 'all' | 'own' | 'collected'
export const playlistFilters: { key: PlaylistFilter, label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'own', label: '自建' },
  { key: 'collected', label: '收藏' },
]

export function filterPlaylists(f: PlaylistFilter): Playlist[] {
  if (f === 'own')
    return ownPlaylists
  if (f === 'collected')
    return collectedPlaylists
  return playlists.filter(p => p.kind !== 'liked')
}

export function matchSong(s: Song, q: string): boolean {
  return s.title.toLowerCase().includes(q)
    || s.album.toLowerCase().includes(q)
    || s.artists.some(a => a.toLowerCase().includes(q))
}
