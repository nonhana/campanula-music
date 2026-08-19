import type { NcmBindingStatus, NcmErrorCode, NcmQrStatus } from '$lib/types'
import { ncmFetchJson } from './client'

/**
 * 绑定页与绑定心跳的客户端数据入口。
 *
 * 页面/布局只经本模块访问 /api/binding/*（服务端网易云门面的薄代理），
 * 测试注入假 provider 响应即由此处替换（vi.mock 本模块）。
 * 状态类型与门面共用 $lib/types/ncm（NcmBindingStatus / NcmQrStatus）
 */

/** 绑定状态（服务端心跳判定结果） */
export type BindingStatusResponse = NcmBindingStatus

/** 二维码绑定启动结果 */
export interface QrLoginStart {
  key: string
  qrUrl: string
  qrimg: string
}

/** 扫码轮询状态 */
export type QrPollStatus = NcmQrStatus

/** 扫码轮询结果 */
export interface QrPollResponse {
  status: NcmQrStatus
}

/** 绑定心跳周期：冷启动校验一次后低频复检（网易云校验接口不抗高频） */
export const BINDING_HEARTBEAT_INTERVAL = 30 * 60 * 1000

/** 扫码轮询间隔：网易云官方轮询端点，2 秒一拍不触发风控 */
export const QR_POLL_INTERVAL = 2000

/** 绑定失败（服务端错误码 + 可展示消息） */
export { NcmClientError as BindingClientError } from './client'

/** 错误码 → 页面文案（satisfies 保证新增错误码必须在编译期补齐文案） */
export const BINDING_ERROR_TEXT = {
  UNAUTHENTICATED: '网易云账号未绑定或绑定已失效，请重新扫码绑定',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  RESOURCE_UNAVAILABLE: '绑定服务暂不可用',
  UNKNOWN: '绑定服务出错，请重试',
} satisfies Record<NcmErrorCode, string>

/** 绑定状态 → 全局行为（纯函数，供心跳编排单测） */
export type BindingAction = 'bind' | 'mark-invalid' | 'clear'

/** 尚未绑定 → 进入全屏绑定页；绑定失效 → 全局失效提示；有效 → 清除提示 */
export function decideBindingAction(status: BindingStatusResponse): BindingAction {
  if (status.status === 'unbound')
    return 'bind'
  if (status.status === 'invalid')
    return 'mark-invalid'
  return 'clear'
}

/** 绑定状态：冷启动与心跳复检共用 */
export function fetchBindingStatus(signal?: AbortSignal): Promise<BindingStatusResponse> {
  return ncmFetchJson<BindingStatusResponse>('/api/binding/status', signal)
}

/** 二维码绑定第一步：获取 key 与二维码图片 */
export function startQrLogin(signal?: AbortSignal): Promise<QrLoginStart> {
  return ncmFetchJson<QrLoginStart>('/api/binding/qr', signal)
}

/** 二维码绑定第二步：轮询扫码状态；确认态由服务端完成凭据写入。时间戳参数防任何中间层缓存（Spec 硬性要求） */
export function fetchQrStatus(key: string, signal?: AbortSignal): Promise<QrPollResponse> {
  // 每拍唯一时间戳：即使路径上有缓存层（浏览器启发式缓存/代理），也能拿到实时状态
  const ts = Date.now()
  return ncmFetchJson<QrPollResponse>(`/api/binding/qr/status?key=${encodeURIComponent(key)}&t=${ts}`, signal)
}
