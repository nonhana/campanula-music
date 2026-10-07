// PROTOTYPE（变体 C）：只属于这个变体的界面状态（菜单、搜索历史、搜索面板开合）。
import type { Song } from '$lib/prototype/data'
import { nav } from '$lib/prototype/nav.svelte'

export interface MenuState {
  song: Song
  /** 桌面：浮层的锚点（视口坐标）；手机：底部弹层 */
  x: number
  y: number
  sheet: boolean
  /** 从 ••• 打开时浮层右边对齐按钮；右键打开时左上角对齐鼠标 */
  alignEnd: boolean
  /** 关闭后把焦点还给它 */
  returnFocus?: HTMLElement | null
}

class UiC {
  menu = $state<MenuState | null>(null)
  /** 搜索历史只保存在本机 */
  history = $state<string[]>(['初音ミク', '春嵐', 'Vivid BAD SQUAD', '钢琴', 'ロウワー', 'millsage'])
  /** 桌面的即时搜索面板 / 手机的全屏搜索 */
  searchOpen = $state(false)
  /** 被 / 键或手机搜索条请求聚焦 */
  focusTick = $state(0)

  openMenu(song: Song, e: MouseEvent | KeyboardEvent, sheet: boolean) {
    const target = e.currentTarget as HTMLElement | null
    let x = 0
    let y = 0
    const fromPointer = e instanceof MouseEvent && e.type === 'contextmenu'
    if (fromPointer) {
      x = e.clientX
      y = e.clientY
    }
    else if (target) {
      const r = target.getBoundingClientRect()
      x = r.right
      y = r.bottom + 4
    }
    this.menu = { song, x, y, sheet, alignEnd: !fromPointer, returnFocus: target }
  }

  closeMenu() {
    const back = this.menu?.returnFocus
    this.menu = null
    back?.focus({ preventScroll: true })
  }

  remember(q: string) {
    const t = q.trim()
    if (!t)
      return
    this.history = [t, ...this.history.filter(h => h !== t)].slice(0, 8)
  }

  requestFocus() {
    // 歌单页里搜索框是限定的，只聚焦、不展开面板
    if (nav.screen === 'library')
      this.searchOpen = true
    this.focusTick++
  }
}

export const ui = new UiC()
