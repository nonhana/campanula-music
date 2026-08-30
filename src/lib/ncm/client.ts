import type { NcmErrorCode } from '$lib/types'
import { browser } from '$app/environment'
import { markBindingInvalid } from '$lib/binding/bindingStore'

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
 * 把捕获的未知错误转为用户可读文案：领域错误（NcmClientError）的消息来自服务端
 * envelope，已是面向用户的中文；其余原始 Error 的 message 是英文技术文本，
 * 不得直出给用户，回落到调用方提供的文案
 */
export function ncmErrorText(err: unknown, fallback: string): string {
  return err instanceof NcmClientError ? err.message : fallback
}

/**
 * 领域错误码白名单：只有门面声明的码会透传给页面分支；
 * 新增服务端码必须同步进此表，客户端按码分支。
 * satisfies 保证新增领域码必须在编译期同步进此表。
 */
const NCM_ERROR_CODES = [
  'UNAUTHENTICATED',
  'RATE_LIMITED',
  'RESOURCE_UNAVAILABLE',
  'INVALID_PARAMS',
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
  // 绑定失效是全局态：任何业务接口报 UNAUTHENTICATED 都同步触发全局失效提示
  // （横幅 + 引导回绑定页），页面级文案由各数据模块另行呈现。
  // 编排属客户端 UI：SSR 进程的 store 是跨请求共享单例，服务端置位会污染后续请求的首屏 HTML
  if (browser && code === 'UNAUTHENTICATED')
    markBindingInvalid()
  return new NcmClientError(code, message)
}

/**
 * GET 请求服务端门面代理并返回领域 JSON；失败抛 NcmClientError，网络异常原样透传。
 * fetcher 供 SvelteKit load 在服务端执行时注入 event.fetch（全局 fetch 在服务端无法解析相对路径）
 */
export async function ncmFetchJson<T>(path: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<T> {
  return ncmFetch<T>(path, { signal }, fetcher)
}

/** POST JSON 请求服务端门面代理并返回领域 JSON；失败抛 NcmClientError，网络异常原样透传 */
export async function ncmFetchJsonPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return ncmFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}

/** DELETE 请求服务端门面代理并返回领域 JSON；失败抛 NcmClientError，网络异常原样透传 */
export async function ncmFetchJsonDelete<T>(path: string, signal?: AbortSignal): Promise<T> {
  return ncmFetch<T>(path, { method: 'DELETE', signal })
}

async function ncmFetch<T>(path: string, init: RequestInit, fetcher: typeof fetch = fetch): Promise<T> {
  const res = await fetcher(path, init)
  if (!res.ok) {
    throw await decodeError(res)
  }
  return await res.json() as T
}
