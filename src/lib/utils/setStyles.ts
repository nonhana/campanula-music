import type * as CSS from 'csstype'

export function setStyles(el: HTMLElement | null, styles: CSS.Properties) {
  if (!el)
    return
  Object.assign(el.style, styles)
}
