import type { ApiError, ErrorBody } from '$lib/api/errors'
import { json } from '@sveltejs/kit'
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
export function errorResponse(error: ApiError): Response {
  const headers: Record<string, string> = error.kind === 'rateLimited' ? { 'retry-after': String(error.retryAfter) } : {}
  return json({ error } satisfies ErrorBody, { status: STATUS[error.kind], headers })
}

/** 跑接口的处理函数：调网易云失败时按错误约定回给客户端，其他错误照常抛出 */
export async function withNetease(handle: () => Promise<Response>): Promise<Response> {
  try {
    return await handle()
  }
  catch (error) {
    if (error instanceof NeteaseError)
      return errorResponse(error.failure)
    throw error
  }
}
