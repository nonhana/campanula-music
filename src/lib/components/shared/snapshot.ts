import { snapshot } from '$app/navigation'
import type { RouteId } from '$app/types'

import { atOnce } from './motion'

/**
 * 返回一页时把页面状态（歌单筛选、歌单内搜索词）和滚动位置一起恢复（Spec #11 用户故事 31）。SvelteKit 先滚到记下的位置再恢复
 * snapshot，状态让页面变高变矮时滚动锚定会把位置挪走，所以恢复状态、画好页面后再滚一次；状态用 atOnce 直接到位，位置按恢复好的高度算。
 */
export const scrollSnapshot = <T>(id: RouteId, read: () => T, write: (value: T) => void): void => {
  snapshot({
    id,
    capture: () => ({
      value: read(),
      scrollY: window.scrollY,
    }),
    restore: ({ value, scrollY }) => {
      atOnce(() => write(value))
      window.scrollTo(0, scrollY)
    },
  })
}
