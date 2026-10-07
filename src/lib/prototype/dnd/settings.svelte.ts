// PROTOTYPE：原型面板里可以调的参数。只在内存里，刷新即恢复默认。

export type CommitOutcome = 'ok' | 'fail'
export type RemoveStyle = 'undo' | 'confirm'
export type UploadOutcome = 'ok' | 'fail-alloc' | 'fail-upload' | 'fail-set'
export type UploadSpeed = 'fast' | 'normal' | 'slow'

export const settings = $state({
  /** 假接口的结果：成功，或失败（用来看回滚） */
  commitOutcome: 'ok' as CommitOutcome,
  /** 每个假请求的往返时间（毫秒），服务器在境外，跨境延迟大 */
  latency: 600,
  /** 拖完后等多久才把整张歌单的顺序提交出去（毫秒）；期间再拖就重新计时，合并成一次提交 */
  mergeDelay: 2000,
  /** 批量移除：撤销提示，还是先弹确认 */
  removeStyle: 'undo' as RemoveStyle,
  /** 长按多久算长按（毫秒） */
  longPress: 400,
  /** 自动滚动：拖到边缘最深处的速度（像素/秒）。dnd-kit 换算成它的 acceleration */
  maxSpeed: 1600,
  /** 自动滚动：停在边缘不动时，最多加速到几倍（只有自写引擎有） */
  accel: 8,
  /** 自动滚动：几秒加速到最大 */
  accelTime: 3,
  /** 自动滚动：边缘区的高度（像素，只有自写引擎能改） */
  zone: 72,
  /** 拖到右侧的快速定位条上按比例跳转（只有自写引擎有） */
  scrubber: true,
  /** 封面：三步里哪一步失败 */
  uploadOutcome: 'ok' as UploadOutcome,
  /** 封面：上传速度 */
  uploadSpeed: 'normal' as UploadSpeed,
})

export const uploadBytesPerSecond: Record<UploadSpeed, number> = {
  fast: 2_000_000,
  normal: 400_000,
  slow: 60_000,
}
