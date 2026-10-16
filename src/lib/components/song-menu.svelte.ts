import type { Song } from '#lib/api/library.js'
import type { PlaySource } from '#lib/app/player.js'
import { page } from '$app/state'
import { desktopLayout } from './layout'
import { pushShallowState } from './shallow-state'

// 歌曲的“更多”菜单（DESIGN.md Song Row、Overlays）：歌曲行、首页歌曲格的 ••• 和右键打开同一份。
// 怎么出现按输入方式切换，不按宽度（Spec #11 界面）：触屏点 ••• 是底部弹层；鼠标点 •••、右键是贴着锚点的浮动菜单（窄窗口里也是）；
// 键盘按 ••• 时看布局，手机布局用底部弹层。底部弹层压一条浅路由历史（page.state.songSheet），返回先收起它。
// 菜单本身画在 SongMenu.svelte 里，整个登录后的骨架只有一份

export interface SongMenuRequest {
  song: Song
  /** 菜单里把歌放进播放队列时，这首歌的播放来源 */
  source: PlaySource
  /**
   * 浮动菜单贴着哪：x、y 是锚点（视口坐标），end 为 true 时菜单右边对齐 x（••• 按钮），否则左边对齐 x（右键的指针）；
   * 菜单在 y 下面，放不下时翻到 top 上面。底部弹层时是 null
   */
  anchor: { x: number, y: number, top: number, end: boolean } | null
  /** 关掉后焦点回到这里 */
  from: HTMLElement | null
}

export const songMenu: { request: SongMenuRequest | null } = $state({ request: null })

function open(request: SongMenuRequest): void {
  songMenu.request = request
  if (!request.anchor && !page.state.songSheet)
    pushShallowState({ ...page.state, songSheet: true })
}

/** 从 ••• 打开的浮动菜单离按钮这么远（px） */
const BUTTON_GAP = 4

/** ••• 按钮的 onclick：触屏用底部弹层，鼠标用贴着按钮的浮动菜单；键盘按下的看布局。菜单已经从这个按钮打开着就关上 */
export function openSongMenuFrom(event: MouseEvent, song: Song, source: PlaySource): void {
  const button = event.currentTarget as HTMLElement
  if (songMenu.request?.from === button)
    return closeSongMenu()
  const pointer = event instanceof PointerEvent ? event.pointerType : ''
  const sheet = pointer === 'touch' || pointer === 'pen' || (pointer === '' && !desktopLayout.current)
  const rect = button.getBoundingClientRect()
  open({ song, source, from: button, anchor: sheet ? null : { x: rect.right, y: rect.bottom + BUTTON_GAP, top: rect.top - BUTTON_GAP, end: true } })
}

/**
 * 歌曲行的 oncontextmenu：鼠标右键在指针处打开浮动菜单；键盘的菜单键贴着这一行打开。
 * 触屏长按不接（留给多选，Spec #11 多选），浏览器照常处理
 */
export function openSongMenuAt(event: MouseEvent, song: Song, source: PlaySource): void {
  if (event instanceof PointerEvent && event.pointerType === 'touch')
    return
  event.preventDefault()
  const row = event.currentTarget as HTMLElement
  const keyboard = event.clientX === 0 && event.clientY === 0
  const rect = row.getBoundingClientRect()
  const anchor = keyboard
    ? { x: rect.right - 8, y: rect.bottom, top: rect.top, end: true }
    : { x: event.clientX, y: event.clientY, top: event.clientY, end: false }
  const focused = document.activeElement instanceof HTMLElement && row.contains(document.activeElement) ? document.activeElement : null
  open({ song, source, from: focused, anchor })
}

/** 菜单关上：焦点回到打开它的地方（还在页面上的话） */
export function dismissSongMenu(request: SongMenuRequest): void {
  songMenu.request = null
  if (request.from?.isConnected)
    request.from.focus({ preventScroll: true })
}

/** 关掉菜单：底部弹层退回压的那条浏览记录（收起交给返回）；浮动菜单直接关上 */
export function closeSongMenu(): void {
  const request = songMenu.request
  if (!request)
    return
  if (!request.anchor && page.state.songSheet) {
    history.back()
    return
  }
  dismissSongMenu(request)
}
