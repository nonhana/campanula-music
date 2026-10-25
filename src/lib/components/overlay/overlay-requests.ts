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
  /** 桌面动作行放不下添加 / 多选时，由 ••• 一并收着 */
  readonly compact: boolean
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

/** 页头“下载”打开的选歌弹窗（#39）：歌单或专辑，列当前页的歌让人挑 */
export type DownloadPickerRequest
  = | (DialogRequest & { readonly kind: 'playlist', readonly playlistId: number })
    | (DialogRequest & { readonly kind: 'album', readonly albumId: number })

/** 导出（#79）：歌曲菜单转交的一首，或多选工具条打开的勾选的几首（multi：不能比多选层活得更久，写完收起多选） */
export interface ExportRequest extends DialogRequest {
  readonly songs: readonly Song[]
  readonly multi: boolean
}

/** 删除多选里勾选的几首下载之前确认（#79） */
export interface DeleteDownloadsRequest extends DialogRequest {
  readonly songs: readonly Song[]
}

/** 按歌单删除下载之前确认（#40）：只删从这张歌单下的，别处也下载过的留着（规则⑦） */
export interface DeletePlaylistDownloadsRequest extends DialogRequest {
  readonly playlistId: number
  readonly name: string
  readonly count: number
}
