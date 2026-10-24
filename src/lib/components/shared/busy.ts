import type { HTMLButtonAttributes } from 'svelte/elements'

type Click = HTMLButtonAttributes['onclick']

/** 进行中（DESIGN.md Buttons · Busy）点了不算，Button、TextButton 共用；提交按钮也拦下（回车隐式提交走这次点按）。不用 disabled，焦点留在按钮上 */
export const busyClick = (busy: () => boolean, onclick: Click): Click => (event) => {
  if (busy()) {
    event.preventDefault()
    return
  }
  onclick?.(event)
}
