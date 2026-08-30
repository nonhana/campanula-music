import { json } from '@sveltejs/kit'
import { NcmError } from './errors'

/** 错误码 → HTTP 状态码（门面未携带上游状态时兜底） */
const ERROR_STATUS: Record<NcmError['code'], number> = {
  UNAUTHENTICATED: 401,
  RATE_LIMITED: 429,
  RESOURCE_UNAVAILABLE: 404,
  INVALID_PARAMS: 400,
  UNKNOWN: 500,
}

/**
 * 把门面调用失败收敛为统一错误 JSON 响应：领域错误保留状态与码，
 * 非领域异常按 UNKNOWN 兜底。
 *
 * 状态码只采用 >= 400 的 HTTP 错误码：上游偶发「HTTP 200 + 业务失败码」的
 * 返回形态（如登录失效 801/802/803），门面按业务码分类后若透传 200，
 * 客户端会按 res.ok 误判成功，故此处回落按错误码的标准状态。
 */
export function ncmErrorJson(err: unknown, fallbackMessage: string): Response {
  const ncmErr = err instanceof NcmError ? err : new NcmError('UNKNOWN', fallbackMessage, { cause: err })
  const status = ncmErr.status && ncmErr.status >= 400 ? ncmErr.status : ERROR_STATUS[ncmErr.code]
  return json(
    { error: { code: ncmErr.code, message: ncmErr.message } },
    { status },
  )
}
