import { page } from '$app/state'
import { tick } from 'svelte'
import { desktopLayout } from './layout'
import { pushShallowState } from './shallow-state'

// 要打断一下的操作（DESIGN.md Overlays · 弹窗）：歌单编辑（新建、编辑信息、改公开、删除，#33）和退出登录的确认（#57）。
// 桌面是居中弹窗，手机是底部弹层，按布局分，不按输入方式；画出来的外壳是 DialogShell.svelte。
// 底部弹层压一条浅路由历史（page.state 里 key 那一项），返回先收起它；从底部弹层的菜单（•••、加入歌单、多选的加入歌单）打开时
// 换掉菜单压的那一条，返回直接收起，不再回到菜单。登录后的骨架里每种各只有一份

/** 打开一个弹窗：关掉后焦点回到 from */
export interface DialogRequest {
  from: HTMLElement | null
}

/**
 * 一个弹窗开着的是什么。请求原样存（$state.raw）：里面的歌要交回给 App，深层代理过的对象存不进本机数据库（#38）
 */
export class DialogLayer<R extends DialogRequest> {
  request = $state.raw<R | null>(null)
  /** 以底部弹层开着（手机布局）：打开时定下，开着时换了布局也不变 */
  sheet = $state(false)
  /** 正在等网易云回话（新建歌单）：这时关不掉（Esc、遮罩、拖动、返回都不算），免得没成时原因说给了一个已经关掉的弹窗 */
  busy = $state(false)

  constructor(readonly key: 'editorSheet' | 'logoutSheet') {}

  open = (request: R): void => {
    this.request = request
    this.sheet = !desktopLayout.current
    const fromSheet = page.state.playlistMenuSheet === true || page.state.playlistSheet === true || page.state.batchSheet === true
    if (!this.sheet) {
      // 桌面布局上用触屏打开的菜单是底部弹层，弹窗不压浏览记录：退掉菜单压的那一条
      if (fromSheet)
        history.back()
      return
    }
    if (page.state[this.key])
      return
    const state: App.PageState = { ...page.state }
    state[this.key] = true
    delete state.playlistMenuSheet
    delete state.playlistSheet
    delete state.batchSheet
    pushShallowState(state, { replace: fromSheet })
  }

  /** 关上，焦点回到打开它的地方（还在页面上的话）。返回手势已经退掉了浅路由时直接用它 */
  dismiss = (request: R): void => {
    this.request = null
    // 开着时骨架是 inert 的（SignedInFrame），要等这一帧更新完拿掉它，焦点才放得回去
    void tick().then(() => {
      if (request.from?.isConnected)
        request.from.focus({ preventScroll: true })
    })
  }

  /** 关掉：底部弹层另外退掉压的那条浏览记录。忙着时不关 */
  close = (): void => {
    const request = this.request
    if (!request || this.busy)
      return
    this.dismiss(request)
    if (this.sheet && page.state[this.key])
      history.back()
  }

  /**
   * 关上、焦点不还回去，等底部弹层压的浅路由退掉了才返回：接着要换掉这一页的浏览记录时用
   * （在歌单页上删掉这张歌单、退出登录），不然换掉的是浅路由那一条，返回会回到原来的页面
   */
  leave = async (): Promise<void> => {
    this.request = null
    if (!this.sheet || !page.state[this.key])
      return
    await new Promise<void>((done) => {
      addEventListener('popstate', () => setTimeout(done), { once: true })
      history.back()
    })
  }
}
