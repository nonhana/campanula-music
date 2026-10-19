import type { Song } from '#lib/api/library.js'
import type { OverlayRequest } from './overlay-layer.svelte'
import { goto } from '$app/navigation'
import { resolve } from '$app/paths'
import { page } from '$app/state'
import { desktopLayout } from './layout'
import { OverlayLayer } from './overlay-layer.svelte'
import { pushShallowState } from './shallow-state'

// 歌单的增删改（#33，原型 PlaylistActions、PlaylistEditor）：
// - 歌单页头部的 •••（只有自建歌单有）：编辑歌单信息、改为公开（隐私歌单才有）、删除歌单。和歌曲的“更多”菜单一样，
//   鼠标是贴着按钮的浮动菜单，触屏是底部弹层（PlaylistMenu.svelte，外壳 MenuOverlay）；
// - 编辑：新建、编辑歌单信息、改为公开、删除歌单。桌面是居中弹窗，手机是底部弹层（PlaylistEditor.svelte），按布局分，不按输入方式。
//   底部弹层压一条浅路由历史（page.state.editorSheet），返回先收起它；从底部弹层的菜单（•••、加入歌单）打开时换掉菜单压的那一条，
//   返回直接收起编辑，不再回到菜单。登录后的骨架里各只有一份

export interface PlaylistMenuRequest extends OverlayRequest {
  playlistId: number
}

export const playlistMenu = new OverlayLayer<PlaylistMenuRequest>('playlistMenuSheet')

/** 编辑什么：新建（从加入歌单、多选里新建时带着这几首歌，建好接着加进去），或者一张自建歌单的信息、改公开、删除；关掉后焦点回到 from */
export type EditorRequest
  = | { mode: 'new', songs: readonly Song[], from: HTMLElement | null }
    | { mode: 'info' | 'public' | 'delete', playlistId: number, from: HTMLElement | null }

class PlaylistEditor {
  request = $state<EditorRequest | null>(null)
  /** 以底部弹层开着（手机布局）：打开时定下，开着时换了布局也不变 */
  sheet = $state(false)
  /** 正在等网易云建好新歌单：这时关不掉（Esc、遮罩、拖动、返回都不算），免得没建成时原因说给了一个已经关掉的弹窗 */
  busy = $state(false)

  open = (request: EditorRequest): void => {
    this.request = request
    this.sheet = !desktopLayout.current
    const fromSheet = page.state.playlistMenuSheet === true || page.state.playlistSheet === true || page.state.batchSheet === true
    if (!this.sheet) {
      // 桌面布局上用触屏打开的菜单是底部弹层，弹窗不压浏览记录：退掉菜单压的那一条
      if (fromSheet)
        history.back()
      return
    }
    if (page.state.editorSheet)
      return
    const state: App.PageState = { ...page.state, editorSheet: true }
    delete state.playlistMenuSheet
    delete state.playlistSheet
    delete state.batchSheet
    pushShallowState(state, { replace: fromSheet })
  }

  /** 关上，焦点回到打开它的地方（还在页面上的话）。返回手势已经退掉了浅路由时直接用它 */
  dismiss = (request: EditorRequest): void => {
    this.request = null
    if (request.from?.isConnected)
      request.from.focus({ preventScroll: true })
  }

  /** 关掉：底部弹层另外退掉压的那条浏览记录。正在新建时不关 */
  close = (): void => {
    const request = this.request
    if (!request || this.busy)
      return
    this.dismiss(request)
    if (this.sheet && page.state.editorSheet)
      history.back()
  }

  /**
   * 关上并回到曲库（在歌单页上删掉这张歌单）：桌面是首页，手机是歌单标签。焦点不还回去；先退掉底部弹层压的浅路由，
   * 再换掉这一页的浏览记录，返回时不会回到已经删掉的歌单页
   */
  leaveToLibrary = async (): Promise<void> => {
    this.request = null
    if (this.sheet && page.state.editorSheet) {
      await new Promise<void>((done) => {
        addEventListener('popstate', () => setTimeout(done), { once: true })
        history.back()
      })
    }
    await goto(resolve(desktopLayout.current ? '/' : '/playlists'), { replaceState: true })
  }
}

export const playlistEditor = new PlaylistEditor()
