import type { Endpoint } from '#lib/api/endpoint.js'
import type { ApiError, ErrorBody } from '#lib/api/errors.js'

import { NeteaseError } from './netease'

const STATUS = {
  needsLogin: 401,
  rateLimited: 429,
  upstreamChanged: 502,
  neteaseUnavailable: 503,
  rejected: 422,
  cookieSecretMissing: 500,
} satisfies Record<ApiError['kind'], number>

/** 按错误约定回 ErrorBody */
export const errorResponse = (error: ApiError): Response => {
  const headers: Record<string, string> = error.kind === 'rateLimited'
    ? {
        'retry-after': String(error.retryAfter),
      }
    : {}
  return Response.json({ error } satisfies ErrorBody, { status: STATUS[error.kind], headers })
}

/** 按端点的响应类型回 JSON：值和端点目录里那一条的响应类型对不上时编译不过；NoInfer 不让 unknown 反过来盖掉端点的类型 */
export const json = <Value>(_endpoint: Endpoint<Value>, body: NoInfer<Value>): Response =>
  // 端点只在编译期用：运行时和以前一样只回正文
  Response.json(body)

/** 跑接口的处理函数：调网易云失败时按错误约定回给客户端，其他错误照常抛出 */
export const withNetease = async <Value>(endpoint: Endpoint<Value>, handle: () => NoInfer<Value> | Promise<NoInfer<Value>>): Promise<Response> => {
  try {
    return json(endpoint, await handle())
  }
  catch (error) {
    if (error instanceof NeteaseError)
      return errorResponse(error.failure)
    throw error
  }
}
