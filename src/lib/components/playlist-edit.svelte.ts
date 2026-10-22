import type { Song } from '#lib/api/library.js'
import type { DialogRequest } from './dialog-layer.svelte'
import type { OverlayRequest } from './overlay-layer.svelte'
import { DialogLayer } from './dialog-layer.svelte'
import { OverlayLayer } from './overlay-layer.svelte'

// 歌单的增删改（#33，原型 PlaylistActions、PlaylistEditor）：
// - 歌单页头部的 •••（只有自建歌单有）：编辑歌单信息、改为公开（隐私歌单才有）、删除歌单。和歌曲的“更多”菜单一样，
//   鼠标是贴着按钮的浮动菜单，触屏是底部弹层（PlaylistMenu.svelte，外壳 MenuOverlay）；
// - 编辑：新建、编辑歌单信息、改为公开、删除歌单。桌面是居中弹窗，手机是底部弹层（PlaylistEditor.svelte，外壳 DialogShell），
//   底部弹层压的浅路由是 page.state.editorSheet。登录后的骨架里各只有一份

export interface PlaylistMenuRequest extends OverlayRequest {
  playlistId: number
}

export const playlistMenu = new OverlayLayer<PlaylistMenuRequest>('playlistMenuSheet')

/** 编辑什么：新建（从加入歌单、多选里新建时带着这几首歌，建好接着加进去），或者一张自建歌单的信息、改公开、删除；关掉后焦点回到 from */
export type EditorRequest
  = | (DialogRequest & { mode: 'new', songs: readonly Song[] })
    | (DialogRequest & { mode: 'info' | 'public' | 'delete', playlistId: number })

export const playlistEditor = new DialogLayer<EditorRequest>('editorSheet')
