import type { DialogRequest } from './dialog-layer.svelte'
import { DialogLayer } from './dialog-layer.svelte'

// 从自建歌单页添加歌曲（#35 补充）：桌面是居中弹窗，手机是底部弹层（和 #33 的编辑歌单一致，外壳 DialogShell）。
// 底部弹层压一条浅路由历史（page.state.addSongsSheet），返回先收起它。
// 从空状态打开的没有 from：关上后焦点回到页头的“添加歌曲”

export interface AddSongsRequest extends DialogRequest {
  playlistId: number
}

export const addSongsDialog = new DialogLayer<AddSongsRequest>('addSongsSheet', '[data-add-songs-entry]')
