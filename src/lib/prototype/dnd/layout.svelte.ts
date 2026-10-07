// PROTOTYPE：按宽度切手机 / 桌面布局（DESIGN.md：小于 768px 用手机布局）。操作细节按每次的 pointerType 判断，不按宽度。

class Layout {
  phone = $state(false)

  constructor() {
    if (typeof window === 'undefined')
      return
    const mq = window.matchMedia('(max-width: 767.98px)')
    this.phone = mq.matches
    mq.addEventListener('change', e => (this.phone = e.matches))
  }

  /** 列表上方被固定栏挡住的高度（自动滚动的边缘区从这里开始算） */
  get topInset(): number {
    return this.phone ? 56 : 64 + 40
  }

  /** 列表下方被固定栏挡住的高度：手机是迷你播放条或批量操作条，桌面是底部通栏 */
  get bottomInset(): number {
    return this.phone ? 84 : 80
  }
}

export const layout = new Layout()
