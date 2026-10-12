import type { Snapshot } from '@sveltejs/kit'
import { tick } from 'svelte'

/**
 * 返回一页时把页面状态（歌单的筛选、歌单内搜索词）和滚动位置一起恢复（Spec #11 用户故事 31）。
 * SvelteKit 先滚到记下的位置、再恢复 snapshot：恢复的状态让页面变短或变长时，浏览器的滚动锚定会把位置挪走，
 * 所以滚动位置也记在 snapshot 里，恢复状态后再滚一次
 */
export function scrollSnapshot<T>(read: () => T, write: (value: T) => void): Snapshot<{ value: T, scrollY: number }> {
  return {
    capture: () => ({ value: read(), scrollY: window.scrollY }),
    restore: ({ value, scrollY }) => {
      write(value)
      void tick().then(() => window.scrollTo(0, scrollY))
    },
  }
}
