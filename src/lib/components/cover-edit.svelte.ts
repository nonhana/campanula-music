import type { CoverState } from '#lib/app/cover.js'
import { page } from '$app/state'
import { desktopLayout } from './layout'
import { pushShallowState } from './shallow-state'

// 换封面的裁剪页（#34，原型 CoverFlow 方案 A）：手机全屏、桌面居中弹窗。从“编辑歌单信息”里的封面打开。
// 手机上压一条浅路由（page.state.coverSheet），返回先收起裁剪页；它压在歌单编辑（editorSheet）上面，
// 退掉这一层时编辑还在。第三步“正在设为封面”发出去以后关不掉，返回也会再压回去。
// 外壳是 CoverEditor.svelte；裁剪、三步上传的状态在 App（state.cover）

export interface CoverRequest {
  playlistId: number
  /** 打开它的地方（换封面按钮、封面本身），关上后焦点回到这里 */
  from: HTMLElement | null
}

class CoverEditor {
  request = $state<CoverRequest | null>(null)

  open = (request: CoverRequest): void => {
    this.request = request
    if (desktopLayout.current) {
      // 桌面是居中弹窗：不压浏览记录；手机上刚退掉的那条（如果有）也退掉
      if (page.state.coverSheet)
        history.back()
      return
    }
    if (page.state.coverSheet)
      return
    pushShallowState({ ...page.state, coverSheet: true })
  }

  /** 关上（焦点回到打开它的地方）；返回手势已经退掉了浅路由时直接用它 */
  dismiss = (request: CoverRequest): void => {
    this.request = null
    if (request.from?.isConnected)
      request.from.focus({ preventScroll: true })
  }
}

export const coverEditor = new CoverEditor()

/** 现在能不能关：第三步已经发给服务器，停不下来 */
export function coverClosable(cover: CoverState | null): boolean {
  return !(cover?.status === 'uploading' && cover.upload.step === 'set')
}
