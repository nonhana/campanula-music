import type { RouteId } from '$app/types'
import { snapshot } from '$app/navigation'
import { atOnce } from './motion'

/**
 * 返回一页时把页面状态（歌单的筛选、歌单内搜索词）和滚动位置一起恢复（Spec #11 用户故事 31）。
 * SvelteKit 先滚到记下的位置、再恢复 snapshot：恢复的状态让页面变短或变长时，浏览器的滚动锚定会把位置挪走，
 * 所以滚动位置也记在 snapshot 里，恢复状态、画好页面后再滚一次。
 * 当场画好、当场滚：换页的过渡（shell/page-transition.ts）等换页完成就拍新的一帧，那时位置已经恢复，看不到先跳到顶再跳回来。
 * 恢复的状态直接到位（motion.ts 的 atOnce）：筛选、搜索结果不在返回的这一页里再淡一次，滚动位置也按恢复好的高度算
 */
export function scrollSnapshot<T>(id: RouteId, read: () => T, write: (value: T) => void): void {
  snapshot({
    id,
    capture: () => ({ value: read(), scrollY: window.scrollY }),
    restore: ({ value, scrollY }) => {
      atOnce(() => write(value))
      window.scrollTo(0, scrollY)
    },
  })
}
