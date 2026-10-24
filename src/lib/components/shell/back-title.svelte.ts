import { untrack } from 'svelte'
import type { Attachment } from 'svelte/attachments'

/**
 * 手机二级页（歌单、专辑、歌手、每日推荐、已下载）返回栏里的页名（DESIGN.md Layout · 手机返回栏）：
 * 平时返回栏只有 ←；页头的大标题（h1）整个滚到返回栏下面以后，← 右边淡入 h1 的文字，滚回去淡出。
 * 页面在页头的 h1 上写 {@attach pageHeading(名字)}，返回栏的 BackTitle 挂 backBar、照着 backTitle 画。
 * 状态只在这里改。同一时刻只有一个 h1：换页时新页的 h1 接替旧的
 */
class BackTitle {
  /** 现在这一页的 h1；还没画出来（在加载）是 null */
  heading = $state<HTMLElement | null>(null)
  /** h1 看得见的字（每日推荐的 h1 后面还有只给读屏的日期，不算） */
  text = $state('')
  /** h1 整个滚到了返回栏下面：返回栏写出页名 */
  shown = $state(false)
  /** 吸在顶上的那一块（返回栏）；返回栏没画出来（桌面、不是二级页）时是 null */
  bar: HTMLElement | null = null

  /**
   * 量一次：h1 的下沿到了返回栏下沿的上面。挂上 h1、返回栏的 attachment 里也调它：
   * 读到的状态不算 attachment 的依赖，不然 h1 一换，attachment 又重新挂、再换一次，停不下来
   */
  measure = (): void => untrack(() => {
    this.shown = this.heading !== null && this.bar !== null
      && this.heading.getBoundingClientRect().bottom <= this.bar.getBoundingClientRect().bottom
  })
}

export const backTitle = new BackTitle()

/**
 * 写在页头的 h1 上：它就是返回栏里要淡入的页名。名字变了（改名、换了一张歌单）重新挂一次。
 * 挂上时就量一次：换页时页名跟着新页直接到位（BackTitle 的 #key），不先写着旧的再淡掉
 */
export const pageHeading = (text: string): Attachment<HTMLElement> => (element) => {
    backTitle.heading = element
    backTitle.text = text
    backTitle.measure()
    return () => untrack(() => {
      if (backTitle.heading !== element)
        return
      backTitle.heading = null
      backTitle.shown = false
    })
  }

/** 挂在返回栏里页名那一格上：量的时候和吸在顶上的那一块（返回栏）的下沿比 */
export const backBar: Attachment<HTMLElement> = (element) => {
  backTitle.bar = element.closest<HTMLElement>('[data-page-top]')
  backTitle.measure()
  return () => {
    backTitle.bar = null
  }
}
