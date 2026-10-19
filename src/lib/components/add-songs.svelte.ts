import { page } from '$app/state'
import { tick } from 'svelte'
import { desktopLayout } from './layout'
import { pushShallowState } from './shallow-state'

// 从自建歌单页添加歌曲（#35 补充）：桌面是居中弹窗，手机是底部弹层（和 #33 的编辑歌单一致）。
// 底部弹层压一条浅路由历史（page.state.addSongsSheet），返回先收起它。

export interface AddSongsRequest {
  playlistId: number
  from: HTMLElement | null
}

class AddSongsDialog {
  request = $state<AddSongsRequest | null>(null)
  /** 以底部弹层开着（手机布局）：打开时定下，开着时换了布局也不变 */
  sheet = $state(false)

  open = (request: AddSongsRequest): void => {
    this.request = request
    this.sheet = !desktopLayout.current
    if (this.sheet && !page.state.addSongsSheet)
      pushShallowState({ ...page.state, addSongsSheet: true })
  }

  /** 返回手势已经退掉了浅路由时直接用它；焦点回到打开它的按钮 */
  dismiss = (request: AddSongsRequest): void => {
    this.request = null
    // 骨架的 inert 要等这一帧更新完才拿掉；空状态打开时没有 from，回到页头的“添加歌曲”
    void tick().then(() => {
      const target = request.from?.isConnected ? request.from : document.querySelector<HTMLElement>('[data-add-songs-entry]')
      target?.focus({ preventScroll: true })
    })
  }

  close = (): void => {
    const request = this.request
    if (!request)
      return
    this.dismiss(request)
    if (this.sheet && page.state.addSongsSheet)
      history.back()
  }
}

export const addSongsDialog = new AddSongsDialog()
