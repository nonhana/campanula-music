import type { Song } from '#lib/api/library.js'
import type { OverlayRequest } from './overlay-layer.svelte'
import { goto } from '$app/navigation'
import { resolve } from '$app/paths'
import { DialogLayer } from './dialog-layer.svelte'
import { desktopLayout } from './layout'
import { OverlayLayer } from './overlay-layer.svelte'

// 歌单的增删改（#33，原型 PlaylistActions、PlaylistEditor）：
// - 歌单页头部的 •••（只有自建歌单有）：编辑歌单信息、改为公开（隐私歌单才有）、删除歌单。和歌曲的“更多”菜单一样，
//   鼠标是贴着按钮的浮动菜单，触屏是底部弹层（PlaylistMenu.svelte，外壳 MenuOverlay）；
// - 编辑：新建、编辑歌单信息、改为公开、删除歌单。桌面是居中弹窗，手机是底部弹层（PlaylistEditor.svelte，怎么开、怎么关见 DialogLayer），
//   底部弹层压的浅路由是 page.state.editorSheet。登录后的骨架里各只有一份

export interface PlaylistMenuRequest extends OverlayRequest {
  playlistId: number
}

export const playlistMenu = new OverlayLayer<PlaylistMenuRequest>('playlistMenuSheet')

/** 编辑什么：新建（从加入歌单、多选里新建时带着这几首歌，建好接着加进去），或者一张自建歌单的信息、改公开、删除；关掉后焦点回到 from */
export type EditorRequest
  = | { mode: 'new', songs: readonly Song[], from: HTMLElement | null }
    | { mode: 'info' | 'public' | 'delete', playlistId: number, from: HTMLElement | null }

class PlaylistEditor extends DialogLayer<EditorRequest> {
  /**
   * 关上并回到曲库（在歌单页上删掉这张歌单）：桌面是首页，手机是歌单标签。焦点不还回去；先退掉底部弹层压的浅路由，
   * 再换掉这一页的浏览记录，返回时不会回到已经删掉的歌单页
   */
  leaveToLibrary = async (): Promise<void> => {
    await this.leave()
    await goto(resolve(desktopLayout.current ? '/' : '/playlists'), { replace: true })
  }
}

export const playlistEditor = new PlaylistEditor('editorSheet')
