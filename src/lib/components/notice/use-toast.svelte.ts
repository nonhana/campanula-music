import { getAppView } from '../shared/app-context.svelte'

/**
 * 纯界面事件的一句话提示（复制、权限这类）：和 App 的语义提示走同一摞提示条。
 * 业务动作（加入歌单、下载、改歌单）由 App 自己发提示，不要在这里写那类文案。
 * 必须在组件初始化时调用：getAppView 读的是组件上下文。
 */
export const useToast = (): { success: (text: string) => number, error: (text: string) => number } => {
  const view = getAppView()
  return {
    success: text => view.app.toast('success', text),
    error: text => view.app.toast('error', text),
  }
}
