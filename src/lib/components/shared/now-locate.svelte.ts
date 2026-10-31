import { createContext } from 'svelte'

import { clamp } from './clamp'
import { scrollBehavior } from './motion'

/** 正在播放那一行：上沿在视口里的位置、行高（px），是不是列表第一行 */
export interface NowRow {
  top: number
  height: number
  first: boolean
}

/**
 * 列表登记给滚动区域主人的（照 scroll-marks.ts 的 ScrollLookup）：row 里读到的列表状态（歌、正在放哪首、多选）由主人追踪，变了就重新判断。
 * 正在放的那首不在这张列表里、多选、拖动排序时 row 给 null，没有按钮。
 */
export interface NowList {
  row: () => NowRow | null
  /** 滚到以后把焦点交给那一行的播放目标（preventScroll，见 focusNowRow） */
  focus: () => void
}

/** 把焦点交给 root 里正在播放那一行的播放目标（songs/PlayTarget 标着 aria-current），不滚动；那一行没画出来就不动 */
export const focusNowRow = (root: ParentNode | undefined): void => {
  root?.querySelector<HTMLElement>('[data-play-target][aria-current="true"]')?.focus({ preventScroll: true })
}

export interface NowRegion {
  /** 滚的是谁；null 是窗口（页面） */
  scroller: () => HTMLElement | null
  /** 看得见的那一段（视口坐标）：被顶栏、播放条、面板边挡住的不算 */
  band: () => { top: number, bottom: number }
}

/**
 * 定位到正在播放（DESIGN.md Layout · 滚动）：滚动区域的主人（三个外框、播放队列）建一份，列表登记自己。
 * 主人判断那一行露没露（away）、画按钮、滚过去。同一个主人只认最后登记的那张列表。
 */
export interface NowLocate {
  /** 正在放的那首在列表里，但那一行没有整行露在看得见的那一段里 */
  readonly away: boolean
  /** 返回撤销登记 */
  register: (list: NowList) => () => void
  /** 平滑滚到那一行停在第二行，滚完把焦点交给它 */
  go: () => void
}

/** 离目标比这么多屏还远：先直接跳到离它一屏的地方，再平滑滚完最后一屏 */
const FAR_SCREENS = 3
/** 量出来的小数误差不算没露出（px） */
const SLACK = 1
/** 不发 scrollend 的浏览器（旧 Safari）：滚动事件停了这么久就算滚完（ms） */
const SCROLL_QUIET_MS = 120

/** 程序滚动停下以后做 done：有 scrollend 就等它，没有就等滚动事件停；一下都没滚（已经在那儿）也会做。返回取消 */
const afterScroll = (target: Window | HTMLElement, done: () => void): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    clearTimeout(timer)
    target.removeEventListener('scroll', wait)
    target.removeEventListener('scrollend', finish)
  }
  const finish = () => {
    stop()
    done()
  }
  const wait = () => {
    clearTimeout(timer)
    timer = setTimeout(finish, SCROLL_QUIET_MS)
  }
  target.addEventListener('scroll', wait, { passive: true })
  target.addEventListener('scrollend', finish)
  wait()
  return stop
}

/** 组件初始化时调用（里面有 $effect） */
export const createNowLocate = (region: NowRegion): NowLocate => {
  let list = $state<NowList | null>(null)
  let away = $state(false)
  let stopFocus: (() => void) | null = null

  const judge = (): void => {
    const row = list?.row() ?? null
    if (!row) {
      away = false
      return
    }
    const band = region.band()
    away = row.top < band.top - SLACK || row.top + row.height > band.bottom + SLACK
  }

  // 换歌、列表变了（同步进来、歌单内搜索）、进出多选：row 里读到的状态一变就重判
  $effect(judge)

  // 滚动、窗口大小变了、内容变高变矮（上面的东西展开、骨架换成内容）也重判
  $effect(() => {
    const el = region.scroller()
    const source = el ?? window
    const sizes = new ResizeObserver(judge)
    sizes.observe(el ?? document.body)
    source.addEventListener('scroll', judge, { passive: true })
    window.addEventListener('resize', judge)
    return () => {
      sizes.disconnect()
      source.removeEventListener('scroll', judge)
      window.removeEventListener('resize', judge)
      stopFocus?.()
    }
  })

  return {
    get away() {
      return away
    },
    register(next) {
      list = next
      return () => {
        if (list === next)
          list = null
      }
    },
    go() {
      const row = list?.row()
      if (!row)
        return
      const el = region.scroller()
      const band = region.band()
      const from = el ? el.scrollTop : window.scrollY
      const end = el
? el.scrollHeight - el.clientHeight
: document.documentElement.scrollHeight - window.innerHeight
      // 上一首停在看得见的最上面一行，第一首停在第一行；快到底、滚不到时停在最底
      const to = clamp(from + row.top - band.top - (row.first ? 0 : row.height), 0, Math.max(0, end))
      const target = el ?? window
      const smooth = scrollBehavior() === 'smooth'
      const screen = band.bottom - band.top
      if (smooth && Math.abs(to - from) > FAR_SCREENS * screen)
        target.scrollTo({ top: to - Math.sign(to - from) * screen, behavior: 'instant' })
      target.scrollTo({
top: to,
behavior: smooth ? 'smooth' : 'instant',
})
      stopFocus?.()
      stopFocus = afterScroll(target, () => {
        stopFocus = null
        list?.focus()
      })
    },
  }
}

export const [getNowLocate, setNowLocate, hasNowLocate] = createContext<NowLocate>()
