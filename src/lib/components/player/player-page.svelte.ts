import type { GrabHandlers } from './drawer.svelte'
import { pushState } from '$app/navigation'
import { page } from '$app/state'
import { createDrawer } from './drawer.svelte'

// 播放页开没开着记在浅路由里（page.state.player）：打开时压一条浏览记录，
// 手机的返回手势、浏览器的后退、Esc、收起键和拖动把手都是退回这一条。手机上拉开播放队列再压一条，返回先收起播放队列

/** 播放页这层抽屉：盖住整页，按视口的高度滑 */
export const playerDrawer = createDrawer(() => window.innerHeight)

/** 播放条上封面和歌名那一块：点按打开播放页，按住往上拖拉开它。每个播放条一份，在组件初始化时调用 */
export function grabToOpenPlayerPage(): GrabHandlers {
  return playerDrawer.grab({ from: 'closed', commit: openPlayerPage, tap: openPlayerPage })
}

export function openPlayerPage(): void {
  if (!page.state.player)
    pushState('', { player: 'open' })
}

export function closePlayerPage(): void {
  if (page.state.player)
    history.go(page.state.player === 'queue' ? -2 : -1)
}

export function openQueueSheet(): void {
  if (page.state.player === 'open')
    pushState('', { player: 'queue' })
}

export function closeQueueSheet(): void {
  if (page.state.player === 'queue')
    history.back()
}

/** 播放页上听众的选择，这次打开 App 期间都记着（刷新后回到默认） */
export const playerPageChoices: {
  /** 桌面右栏显示歌词还是播放队列 */
  panel: 'lyrics' | 'queue'
  /** 手机上封面那块换成了歌词 */
  phoneLyrics: boolean
  /** 有翻译、音译时显示出来 */
  translation: boolean
  romanization: boolean
} = $state({ panel: 'lyrics', phoneLyrics: false, translation: true, romanization: false })
