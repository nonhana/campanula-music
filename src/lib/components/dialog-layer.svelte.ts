import { goto } from '$app/navigation'
import { resolve } from '$app/paths'
import { page } from '$app/state'
import { tick } from 'svelte'
import { desktopLayout } from './layout'
import { pushShallowState } from './shallow-state'

// 要打断一下的操作（DESIGN.md Overlays · 弹窗）：歌单编辑（新建、编辑信息、改公开、删除，#33）、添加歌曲（#35）和退出登录的确认（#57）。
// 桌面是居中弹窗，手机是底部弹层，按布局分，不按输入方式；画出来的外壳是 DialogShell.svelte。
// 底部弹层压一条浅路由历史（page.state 里 sheet 那一项），返回先收起它；从底部弹层的菜单（•••、加入歌单、多选的加入歌单）打开时
// 换掉菜单压的那一条，返回直接收起，不再回到菜单。登录后的骨架里每种各只有一份

/** 打开一个弹窗：关掉后焦点回到 from（不在页面上了就回到 fallback 指的那个元素） */
export interface DialogRequest {
  from: HTMLElement | null
}

/**
 * 一个弹窗开着的是什么；sheet 是它以底部弹层开着时压的那条浅路由记在 page.state 的哪一项（和 OverlayLayer 一样）。
 * 请求原样存（$state.raw）：里面的歌要交回给 App，深层代理过的对象存不进本机数据库（#38）
 */
export class DialogLayer<R extends DialogRequest> {
  request = $state.raw<R | null>(null)
  /** 以底部弹层开着（手机布局）：打开时定下，开着时换了布局也不变 */
  asSheet = $state(false)
  /** 正在等网易云回话（新建歌单、加入歌曲）：这时关不掉（Esc、遮罩、拖动、返回都不算），免得没成时原因说给了一个已经关掉的弹窗 */
  busy = $state(false)

  /**
   * @param sheet 压的浅路由记在 page.state 的哪一项
   * @param fallback from 不在页面上了时焦点回到哪（选择器）：添加歌曲从空状态打开时没有 from，回到页头的入口
   */
  constructor(readonly sheet: 'editorSheet' | 'addSongsSheet' | 'logoutSheet', private readonly fallback?: string) {}

  open = (request: R): void => {
    this.request = request
    this.asSheet = !desktopLayout.current
    const fromSheet = page.state.playlistMenuSheet === true || page.state.playlistSheet === true || page.state.batchSheet === true
    if (!this.asSheet) {
      // 桌面布局上用触屏打开的菜单是底部弹层，弹窗不压浏览记录：退掉菜单压的那一条
      if (fromSheet)
        history.back()
      return
    }
    if (page.state[this.sheet])
      return
    const state: App.PageState = { ...page.state }
    state[this.sheet] = true
    delete state.playlistMenuSheet
    delete state.playlistSheet
    delete state.batchSheet
    pushShallowState(state, { replace: fromSheet })
  }

  /** 关上，焦点回到打开它的地方（还在页面上的话）。返回手势已经退掉了浅路由时直接用它 */
  dismiss = (request: R): void => {
    this.request = null
    this.busy = false
    // 开着时骨架是 inert 的（SignedInFrame），要等这一帧更新完拿掉它，焦点才放得回去
    void tick().then(() => {
      const target = request.from?.isConnected ? request.from : this.fallback ? document.querySelector<HTMLElement>(this.fallback) : null
      target?.focus({ preventScroll: true })
    })
  }

  /** 关掉：底部弹层另外退掉压的那条浏览记录。忙着时不关 */
  close = (): void => {
    const request = this.request
    if (!request || this.busy)
      return
    this.dismiss(request)
    if (this.asSheet && page.state[this.sheet])
      history.back()
  }

  /**
   * 关上、焦点不还回去，等底部弹层压的浅路由退掉了，再把这一页的浏览记录换成 path（在歌单页上删掉这张歌单、退出登录）：
   * 不先退掉的话换掉的是浅路由那一条，返回会回到原来的页面。换页已经开始就返回，不等它走完（接着就删歌单、退出登录）
   */
  leaveTo = async (path: '/' | '/playlists'): Promise<void> => {
    this.request = null
    if (this.asSheet && page.state[this.sheet]) {
      await new Promise<void>((done) => {
        addEventListener('popstate', () => setTimeout(done), { once: true })
        history.back()
      })
    }
    void goto(resolve(path), { replace: true })
  }
}
