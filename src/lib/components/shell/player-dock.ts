export interface DockBottom {
  /** 桌面布局：80px 通栏；手机是 64px 高的浮条 */
  desktop: boolean
  /** 播放条在不在（设计页的示意图也算） */
  present: boolean
  /** 没有播放条时的下沿：各外框的空页不一样 */
  withoutBar: string
}

/**
 * 页面滚动条的下沿：有播放条时到它的上沿（DESIGN.md Layout · 滚动）。
 * 播放条在桌面是 80px 通栏；手机是 64px、离屏幕边 8px，上沿就是 72px 加安全区。
 */
export const playerDockBottom = ({ desktop, present, withoutBar }: DockBottom): string => {
  if (!present)
    return withoutBar
  return desktop ? '80px' : 'calc(72px + env(safe-area-inset-bottom))'
}

/** 播放条（手机多选时是占它位置的操作条）上沿在视口里的位置；没有时是窗口底。定位到正在播放按它算页面看得见的下沿 */
export const playerDockTop = (): number => document.querySelector('[data-player-bar]')?.getBoundingClientRect().top ?? window.innerHeight
