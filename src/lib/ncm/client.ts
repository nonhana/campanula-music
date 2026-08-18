import type { NcmErrorCode } from '$lib/types'

/**
 * 客户端门面调用的共享传输层：请求 /api/* 代理并统一解码领域错误。
 *
 * 页面数据模块（搜索、歌单等）只经本模块 fetch 服务端，
 * 测试注入假 provider 响应即由该层承接。
 */

/** 服务端返回的错误 JSON 形状 */
interface ErrorResponseBody {
  error?: { code?: string, message?: string }
}

/** 门面调用失败（服务端错误码 + 可展示消息），各页面按码呈现文案 */
export class NcmClientError extends Error {
  readonly code: NcmErrorCode

  constructor(code: NcmErrorCode, message: string) {
    super(message)
    this.name = 'NcmClientError'
    this.code = code
  }
}

/**
 * 领域错误码白名单：只有门面声明的码会透传给页面分支；
 * 其余服务端码（如参数校验错误）统一归 UNKNOWN，但其消息仍透传展示。
 * satisfies 保证新增领域码必须在编译期同步进此表。
 */
const NCM_ERROR_CODES = [
  'UNAUTHENTICATED',
  'RATE_LIMITED',
  'RESOURCE_UNAVAILABLE',
  'UNKNOWN',
] as const satisfies readonly NcmErrorCode[]

function isNcmErrorCode(value: string): value is NcmErrorCode {
  return (NCM_ERROR_CODES as readonly string[]).includes(value)
}

async function decodeError(res: Response): Promise<NcmClientError> {
  let code: NcmErrorCode = 'UNKNOWN'
  let message = `请求失败（HTTP ${res.status}）`
  try {
    const body = await res.json() as ErrorResponseBody
    if (body.error?.code) {
      // 非白名单码降级 UNKNOWN，但服务端给的具体消息照常透传（如「缺少有效的歌单 id」）
      if (isNcmErrorCode(body.error.code))
        code = body.error.code
      message = body.error.message ?? message
    }
  }
  catch {
    // 非 JSON 响应体按 UNKNOWN 处理
  }
  return new NcmClientError(code, message)
}

/** GET 请求服务端门面代理并返回领域 JSON；失败抛 NcmClientError，网络异常原样透传 */
export async function ncmFetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal })
  if (!res.ok) {
    throw await decodeError(res)
  }
  return await res.json() as T
}
