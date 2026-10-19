import { page } from '$app/state'
import { desktopLayout } from './layout'
import { pushShallowState } from './shallow-state'

// 菜单类的浮层（DESIGN.md Overlays）：歌曲的“更多”菜单、加入歌单、歌单页的 •••。画出来的外壳是 MenuOverlay.svelte。
// 怎么出现按输入方式切换，不按宽度（Spec #11 界面）：鼠标是贴着锚点的浮动菜单（窄窗口里也是），触屏是底部弹层；
// 底部弹层压一条浅路由历史（page.state 里的 sheet 那一项），返回先收起它

/**
 * 浮动菜单贴着哪：x、y 是锚点（视口坐标），end 为 true 时菜单右边对齐 x（••• 按钮），否则左边对齐 x（右键的指针）；
 * 菜单在 y 下面，放不下时翻到 top 上面
 */
export interface MenuAnchor {
  x: number
  y: number
  top: number
  end: boolean
}

/** 打开一层浮层：浮动菜单贴着 anchor（底部弹层时是 null），关掉后焦点回到 from */
export interface OverlayRequest {
  anchor: MenuAnchor | null
  from: HTMLElement | null
}

/** 一层浮层开着的是什么；sheet 是它以底部弹层开着时压的那条浅路由记在 page.state 的哪一项 */
export class OverlayLayer<R extends OverlayRequest> {
  request = $state<R | null>(null)

  constructor(readonly sheet: 'songSheet' | 'playlistSheet' | 'playlistMenuSheet') {}

  open = (request: R): void => {
    this.request = request
    if (!request.anchor && !page.state[this.sheet]) {
      const state: App.PageState = { ...page.state }
      state[this.sheet] = true
      pushShallowState(state)
    }
  }

  /** 关上：焦点回到打开它的地方（还在页面上的话） */
  dismiss = (request: R): void => {
    this.request = null
    if (request.from?.isConnected)
      request.from.focus({ preventScroll: true })
  }

  /** 关掉：底部弹层退回压的那条浏览记录（收起交给返回）；浮动菜单直接关上 */
  close = (): void => {
    const request = this.request
    if (!request)
      return
    if (!request.anchor && page.state[this.sheet]) {
      history.back()
      return
    }
    this.dismiss(request)
  }
}

/** 从 ••• 打开的浮动菜单离按钮这么远（px） */
const BUTTON_GAP = 4

/**
 * ••• 按钮的 onclick 打开浮层时贴在哪：触屏是底部弹层（null），鼠标贴着按钮（右边对齐）；键盘按下的看布局，手机布局用底部弹层
 */
export function anchorBelow(event: MouseEvent): MenuAnchor | null {
  const pointer = event instanceof PointerEvent ? event.pointerType : ''
  if (pointer === 'touch' || pointer === 'pen' || (pointer === '' && !desktopLayout.current))
    return null
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  return { x: rect.right, y: rect.bottom + BUTTON_GAP, top: rect.top - BUTTON_GAP, end: true }
}
