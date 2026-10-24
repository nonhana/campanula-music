import type { HTMLButtonAttributes } from 'svelte/elements'

type Click = HTMLButtonAttributes['onclick']

/**
 * 按钮进行中（DESIGN.md Buttons · Busy）点了不算：Button、TextButton 共用。
 * 提交按钮也拦下：输入框里按回车的隐式提交走的也是这次点按。不用 disabled，焦点留在按钮上
 */
export function busyClick(busy: () => boolean, onclick: Click): Click {
  return (event) => {
    if (busy()) {
      event.preventDefault()
      return
    }
    onclick?.(event)
  }
}
