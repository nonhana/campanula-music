import { resolve } from '$app/paths'
import { page } from '$app/state'

/**
 * 下载面板（#38）的界面状态：什么时候出现、收起。不是浮层栈里的一层：不压历史、不 inert 背景，关掉再打开不做恢复。
 * 面板在 /downloads 不显示（那一页有完整的“正在下载”）；提示条按展开 / 收起让位。
 */
export const createDownloadPanel = () => {
  let open = $state(false)
  let collapsed = $state(false)
  const onDownloads = $derived(page.url.pathname === resolve('/downloads'))
  /** 真的占着屏幕：开着、没收起、不在已下载页 */
  const expanded = $derived(open && !collapsed && !onDownloads)

  return {
    get open() {
      return open
    },
    get collapsed() {
      return collapsed
    },
    get expanded() {
      return expanded
    },
    get onDownloads() {
      return onDownloads
    },
    /** 出来；收起着的保持收起 */
    reveal() {
      open = true
    },
    collapse() {
      collapsed = true
    },
    expand() {
      open = true
      collapsed = false
    },
    hide() {
      open = false
    },
  }
}
