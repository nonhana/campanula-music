import type { MenuAnchor } from '../overlay/overlay-requests'
import { desktopLayout } from '../shared/layout'

/** 从 ••• 打开的浮动菜单离按钮这么远（px） */
const BUTTON_GAP = 4

/**
 * ••• 按钮的 onclick 打开浮层时贴在哪：触屏是底部弹层（null），鼠标贴着按钮（右边对齐）；键盘按下的看布局，手机布局用底部弹层
 */
export function anchorBelow(event: MouseEvent): MenuAnchor | null {
  const pointer = event instanceof PointerEvent ? event.pointerType : ''
  if (pointer === 'touch' || pointer === 'pen' || (pointer === '' && !desktopLayout.current))
    return null
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  return { x: rect.right, y: rect.bottom + BUTTON_GAP, top: rect.top - BUTTON_GAP, end: true }
}
