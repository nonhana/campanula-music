import type { Song } from '#lib/api/library.js'
import type { PlaySource } from '#lib/api/playback.js'
import { anchorBelow } from './menu-anchor'
import { getOverlays } from './overlay-context'

// 歌曲浮层的入口（DESIGN.md Song Row、Overlays）：“更多”菜单，和从菜单里打开的加入歌单（两层登记在 overlays.svelte.ts）。
// “更多”菜单由歌曲行、首页歌曲格的 ••• 和右键打开。怎么出现按输入方式切换，不按宽度：
// 触屏点 ••• 是底部弹层；鼠标点 •••、右键是贴着锚点的浮动菜单（窄窗口里也是）；键盘按 ••• 时看布局，手机布局用底部弹层。
// 加入歌单跟着菜单：菜单是浮动的，它就贴着同一个锚点浮出来；菜单是底部弹层，它也是底部弹层。

/**
 * 在组件初始化时调用一次：每个歌曲行的入口都用所属外框的那份层会话（Session 销毁时层跟着清空）。
 */
export function songMenuActions() {
  const { songMenu, playlistPicker } = getOverlays()

  /** ••• 按钮的 onclick：触屏用底部弹层，鼠标用贴着按钮的浮动菜单；键盘按下的看布局。菜单或加入歌单已经从这个按钮打开着就关上 */
  function openSongMenuFrom(event: MouseEvent, song: Song, source: PlaySource): void {
    const button = event.currentTarget as HTMLElement
    const shown = [songMenu, playlistPicker].find(layer => layer.request?.from === button)
    if (shown) {
      void shown.close()
      return
    }
    void songMenu.open({ song, source, from: button, anchor: anchorBelow(event) })
  }

  /**
   * 歌曲行的 oncontextmenu：鼠标右键在指针处打开浮动菜单；键盘的菜单键贴着这一行打开。
   * 触屏长按留给多选（#35）：拦掉系统的选择文字 / 上下文菜单，不打开歌曲菜单
   */
  function openSongMenuAt(event: MouseEvent, song: Song, source: PlaySource): void {
    // 触屏长按留给多选（#35）：不要弹出系统的选择文字 / 上下文菜单
    if (event instanceof PointerEvent && event.pointerType === 'touch') {
      event.preventDefault()
      return
    }
    event.preventDefault()
    const row = event.currentTarget as HTMLElement
    const keyboard = event.clientX === 0 && event.clientY === 0
    const rect = row.getBoundingClientRect()
    const anchor = keyboard
      ? { x: rect.right - 8, y: rect.bottom, top: rect.top, end: true }
      : { x: event.clientX, y: event.clientY, top: event.clientY, end: false }
    const focused = document.activeElement instanceof HTMLElement && row.contains(document.activeElement) ? document.activeElement : null
    void songMenu.open({ song, source, from: focused, anchor })
  }

  return { openSongMenuFrom, openSongMenuAt }
}
