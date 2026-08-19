import type { BindingStatusResponse } from '$lib/ncm/binding'
import { goto } from '$app/navigation'
import { decideBindingAction, fetchBindingStatus } from '$lib/ncm/binding'
import { clearBindingInvalid, markBindingInvalid } from './bindingStore'

/**
 * 绑定心跳编排（冷启动一次 + 周期低频复检）。
 *
 * 按绑定状态驱动全局行为：尚未绑定 → 进入全屏绑定页；绑定失效 → 置位
 * 全局失效提示（横幅 + 首条提示）；有效 → 清除提示。
 * 状态拉取瞬时失败（网络/服务异常）静默跳过：不误踢用户，
 * 真实失败会由各业务接口以 UNAUTHENTICATED 如实兜底并触发同样的失效提示。
 * 不做自动保活：网易云无可靠刷新机制，频繁重登触发风控（见 Spec）。
 */
export async function runBindingCheck(): Promise<void> {
  let status: BindingStatusResponse
  try {
    status = await fetchBindingStatus()
  }
  catch {
    return
  }
  const action = decideBindingAction(status)
  if (action === 'bind') {
    clearBindingInvalid()
    await goto('/bind')
  }
  else if (action === 'mark-invalid') {
    markBindingInvalid()
  }
  else {
    clearBindingInvalid()
  }
}
