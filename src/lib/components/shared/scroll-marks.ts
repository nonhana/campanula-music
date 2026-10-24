import { createContext } from 'svelte'

/** 拖滚动条时气泡里写的：列表看得见的最上面那一项 */
export interface ScrollMark {
  caption: string
  title: string
  lang?: string
}

/** 滚动条和列表的约定：列表填 markAt（看得见的最上沿哪一项），滚动条拖时读。滚动区域的主人建一份放进上下文、也传给自己的滚动条，列表拿最近的那份 */
export interface ScrollLookup {
  markAt: ((top: number) => ScrollMark | null) | null
}

export const [getScrollLookup, setScrollLookup, hasScrollLookup] = createContext<ScrollLookup>()
