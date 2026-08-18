import { json } from '@sveltejs/kit'
import { NcmError } from './errors'

/** 错误码 → HTTP 状态码（门面未携带上游状态时兜底） */
const ERROR_STATUS: Record<NcmError['code'], number> = {
  UNAUTHENTICATED: 401,
  RATE_LIMITED: 429,
  RESOURCE_UNAVAILABLE: 404,
  UNKNOWN: 500,
}

/**
 * 把门面调用失败收敛为统一错误 JSON 响应：领域错误保留码与状态，
 * 非领域异常按 UNKNOWN 兜底。
 */
export function ncmErrorJson(err: unknown, fallbackMessage: string): Response {
  const ncmErr = err instanceof NcmError ? err : new NcmError('UNKNOWN', fallbackMessage, { cause: err })
  return json(
    { error: { code: ncmErr.code, message: ncmErr.message } },
    { status: ncmErr.status ?? ERROR_STATUS[ncmErr.code] },
  )
}
