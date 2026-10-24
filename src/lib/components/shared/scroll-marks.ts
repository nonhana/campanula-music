import { createContext } from 'svelte'

/** 按住触屏那一块拖滚动条时，气泡里写的：列表看得见的最上面那一项 */
export interface ScrollMark {
  /** 第一行小字，例如“第 2,341 首” */
  caption: string
  /** 第二行，例如歌名 */
  title: string
  lang?: string
}

/**
 * 滚动条和它滚的那张列表之间的约定：列表填 markAt（给出看得见的最上沿 clientY，返回那里是哪一项），滚动条拖的时候读。
 * 滚动区域的主人（两个骨架管页面，播放队列管自己）创建一份，放进上下文、也传给自己的滚动条；里面的列表从上下文拿最近的那份。
 * 所以列表放进自己滚动的区域时，那个区域的主人也要建一份，不然列表会报给外面页面的那条
 */
export interface ScrollLookup {
  markAt: ((top: number) => ScrollMark | null) | null
}

export const [getScrollLookup, setScrollLookup, hasScrollLookup] = createContext<ScrollLookup>()
