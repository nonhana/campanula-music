import type { Song } from '#lib/api/library.js'
import type { PlaySource } from '#lib/api/playback.js'
import type { OverlayRequest } from './overlay-layer.svelte'
import { page } from '$app/state'
import { anchorBelow, OverlayLayer } from './overlay-layer.svelte'
import { pushShallowState } from './shallow-state'

// 歌曲的浮层（DESIGN.md Song Row、Overlays）：“更多”菜单，和从菜单里打开的加入歌单。
// “更多”菜单由歌曲行、首页歌曲格的 ••• 和右键打开。怎么出现按输入方式切换，不按宽度（overlay-layer.svelte.ts）：
// 触屏点 ••• 是底部弹层；鼠标点 •••、右键是贴着锚点的浮动菜单（窄窗口里也是）；键盘按 ••• 时看布局，手机布局用底部弹层。
// 加入歌单跟着菜单：菜单是浮动的，它就贴着同一个锚点浮出来；菜单是底部弹层，它也是底部弹层。
// 底部弹层压一条浅路由历史（page.state.songSheet、playlistSheet），返回先收起它。
// 画出来的是 SongMenu.svelte 和 AddToPlaylist.svelte（外壳都是 MenuOverlay.svelte），整个登录后的骨架各只有一份

export interface SongMenuRequest extends OverlayRequest {
  song: Song
  /** 菜单里把歌放进播放队列时，这首歌的播放来源；加入歌单时看是不是从这张歌单里打开的 */
  source: PlaySource
}

export const songMenu = new OverlayLayer<SongMenuRequest>('songSheet')
export const playlistPicker = new OverlayLayer<SongMenuRequest>('playlistSheet')

/** ••• 按钮的 onclick：触屏用底部弹层，鼠标用贴着按钮的浮动菜单；键盘按下的看布局。菜单或加入歌单已经从这个按钮打开着就关上 */
export function openSongMenuFrom(event: MouseEvent, song: Song, source: PlaySource): void {
  const button = event.currentTarget as HTMLElement
  const shown = [songMenu, playlistPicker].find(layer => layer.request?.from === button)
  if (shown)
    return shown.close()
  songMenu.open({ song, source, from: button, anchor: anchorBelow(event) })
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
  songMenu.open({ song, source, from: focused, anchor })
}

/**
 * 菜单里点了“加入歌单”：菜单关上（焦点交给加入歌单），在同一个地方打开加入歌单，同一首歌、同一个播放来源、关掉后回到同一个按钮。
 * 底部弹层换掉菜单压的那条浏览记录：返回直接收起加入歌单，不再回到菜单
 */
export function openPlaylistPicker(request: SongMenuRequest): void {
  songMenu.request = null
  playlistPicker.request = request
  if (request.anchor)
    return
  const state: App.PageState = { ...page.state, playlistSheet: true }
  delete state.songSheet
  pushShallowState(state, { replace: page.state.songSheet === true })
}
