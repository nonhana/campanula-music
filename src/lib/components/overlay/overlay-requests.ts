import type { Song } from '#lib/api/library.js'
import type { PlaySource } from '#lib/api/playback.js'

export interface DialogRequest {
  /** 关掉后焦点回到它 */
  readonly from: HTMLElement | null
}

/** x、y 是锚点（视口坐标）；end 为 true 右对齐（••• 按钮），否则左对齐（右键的指针）；菜单在 y 下面，放不下翻到上面 */
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

/** 加入歌单的选择器（#73）：song 是歌曲菜单转交的（songs 只有一首），multi 是多选工具条打开的（勾选的几首）；currentPlaylistId 是打开时所在的歌单 */
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
