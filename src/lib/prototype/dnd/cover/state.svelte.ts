// PROTOTYPE：换封面时，歌单头部要知道的状态（进度环）。CoverFlow 写，DndWorld 读。
import type { UploadJob } from './pipeline.svelte'

export const coverUpload = $state({
  /** 方案 B 里在后台跑的上传；其他方案的上传在弹层里，不放这里 */
  background: null as UploadJob | null,
})
