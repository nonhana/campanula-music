import type { Song } from '#lib/api/library.js'
import type { OverlayRequest } from './overlay-layer.svelte'
import { OverlayLayer } from './overlay-layer.svelte'

// 多选的“加入歌单”（#35）：目标只有“新建歌单”和其他自建歌单；当前歌单不能选，收藏的歌单、我喜欢的音乐不出现（不做批量红心）。
// 鼠标是贴着工具条上那个按钮的浮动菜单，触屏是底部弹层（外壳 MenuOverlay）。

export interface BatchPickerRequest extends OverlayRequest {
  songs: readonly Song[]
  /** 当前打开着的歌单：它的“加入歌单”里不能选自己 */
  currentPlaylistId: number
}

export const batchPicker = new OverlayLayer<BatchPickerRequest>('batchSheet')
