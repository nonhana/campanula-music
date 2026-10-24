import type { Song } from '#lib/api/library.js'
import type { PlaySource } from '#lib/api/playback.js'

export interface DialogRequest {
  /** 打开这个浮层的元素：关掉后焦点回到它 */
  readonly from: HTMLElement | null
}

/**
 * 浮动菜单贴着哪：x、y 是锚点（视口坐标），end 为 true 时菜单右边对齐 x（••• 按钮），否则左边对齐 x（右键的指针）；
 * 菜单在 y 下面，放不下时翻到 top 上面
 */
export interface MenuAnchor {
  readonly x: number
  readonly y: number
  readonly top: number
  readonly end: boolean
}

export interface MenuRequest extends DialogRequest {
  readonly anchor: MenuAnchor | null
}

export interface SongMenuRequest extends MenuRequest {
  readonly song: Song
  readonly source: PlaySource
}

export interface PlaylistMenuRequest extends MenuRequest {
  readonly playlistId: number
}

/**
 * 加入歌单的选择器（#73）：单曲和多选共用同一个。
 * mode song 是歌曲菜单转交来的，songs 只有这一首；mode multi 是多选的工具条打开的，songs 是勾选的几首。
 * currentPlaylistId 是打开时所在的那张歌单：单曲菜单在歌单页打开时是它（“当前歌单”），多选一定是。
 */
export type AddToPlaylistRequest
  = | (MenuRequest & {
    readonly mode: 'song'
    readonly song: Song
    readonly songs: readonly Song[]
    readonly currentPlaylistId: number | null
  })
  | (MenuRequest & {
    readonly mode: 'multi'
    readonly songs: readonly Song[]
    readonly currentPlaylistId: number
  })

export type EditorRequest
  = | (DialogRequest & { readonly mode: 'new', readonly songs: readonly Song[] })
    | (DialogRequest & { readonly mode: 'info' | 'public' | 'delete', readonly playlistId: number })

export interface PlaylistRequest extends DialogRequest {
  readonly playlistId: number
}
