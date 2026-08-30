/**
 * 网易云门面统一领域错误模型。
 *
 * 所有对 hana-music-api 的调用失败时，最终都以 NcmError 形式抛给上层，
 * 路由层与编排逻辑只按 code 分支，不感知上游错误细节。
 */
import type { NcmErrorCode } from '$lib/types'

export type { NcmErrorCode } from '$lib/types'

/** 错误码枚举（顺序即文档顺序），与共享类型 NcmErrorCode 保持一致 */
export const NCM_ERROR_CODES: readonly NcmErrorCode[] = [
  'UNAUTHENTICATED', // 绑定失效，需要重新扫码
  'RATE_LIMITED', // 被限流
  'RESOURCE_UNAVAILABLE', // 无版权或资源不可用
  'INVALID_PARAMS', // 参数校验拒绝（路由层发射，不经上游映射）
  'UNKNOWN', // 兜底
]

export class NcmError extends Error {
  readonly code: NcmErrorCode
  readonly status?: number

  constructor(code: NcmErrorCode, message: string, options: { cause?: unknown, status?: number } = {}) {
    super(message, { cause: options.cause })
    this.name = 'NcmError'
    this.code = code
    this.status = options.status
  }
}

/** hana-music-api 抛出的失败对象形状：{ body: { code, msg }, cookie, status } */
interface SdkFailure {
  body?: { code?: number | string, msg?: string }
  status?: number
}

function isSdkFailure(err: unknown): err is SdkFailure {
  return typeof err === 'object' && err !== null && 'status' in err
}

const UNAUTHENTICATED_PATTERN = /需要登录|未登录|登录状态已失效|登录已过期|not logged|login expired/i
const RATE_LIMITED_PATTERN = /请求过于频繁|操作太频繁|访问过于频繁|too many requests|too frequent/i
const RESOURCE_UNAVAILABLE_PATTERN = /无版权|版权受限|版权保护|暂无版权|no copyright/i

/** SDK 传输层超时的固定文案（client.generated.js：Request timed out after Nms） */
const SDK_TIMEOUT_PATTERN = /^Request timed out after \d+ms$/

/**
 * 把 SDK/上游抛出的任意失败映射为领域错误。
 * - 已是 NcmError 的输入原样返回（幂等）
 * - SDK 失败对象按 status / body.code / body.msg 分类
 * - 其他输入归入 UNKNOWN
 */
export function mapNcmError(err: unknown): NcmError {
  if (err instanceof NcmError)
    return err

  const status = isSdkFailure(err) ? err.status : undefined
  const code = isSdkFailure(err) ? err.body?.code : undefined
  const msg = isSdkFailure(err) ? err.body?.msg : undefined

  // 网易云绑定失效典型信号：HTTP 301、业务码 -462（登录状态失效）或 301（需要登录）、或消息含登录相关字样
  if (status === 301 || code === -462 || code === 301 || (msg != null && UNAUTHENTICATED_PATTERN.test(msg))) {
    return new NcmError('UNAUTHENTICATED', msg || '绑定已失效，需要重新扫码', { cause: err, status })
  }

  // 限流典型信号：HTTP 429、业务码 -460、或消息含频繁相关字样
  if (status === 429 || code === -460 || (msg != null && RATE_LIMITED_PATTERN.test(msg))) {
    return new NcmError('RATE_LIMITED', msg || '请求过于频繁，请稍后再试', { cause: err, status })
  }

  // 无版权典型信号：业务码 -110、或消息含版权相关字样
  if (code === -110 || (msg != null && RESOURCE_UNAVAILABLE_PATTERN.test(msg))) {
    return new NcmError('RESOURCE_UNAVAILABLE', msg || '资源不可用（无版权或仅试听片段）', { cause: err, status })
  }

  // SDK 传输层超时：请求未达上游或响应未归，按资源不可用处理，文案中文化（避免英文超时直出）
  if (msg != null && SDK_TIMEOUT_PATTERN.test(msg)) {
    return new NcmError('RESOURCE_UNAVAILABLE', '上游请求超时，请稍后重试', { cause: err, status })
  }

  // 消息回退链：业务 msg → 业务码 → 真实 Error 消息 → 中文兜底，避免 [object Object] 直出
  const message = msg
    || (code !== undefined ? String(code) : undefined)
    || (err instanceof Error ? err.message : undefined)
    || '未知上游错误'
  return new NcmError('UNKNOWN', message, { cause: err, status })
}
