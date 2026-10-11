import type { ApiError, ErrorBody } from '$lib/api/errors'
import type { BrowserCapabilities } from './browser'

/** 请求 Campanula 服务端没成功的原因：前三种是请求本身的问题，其余是服务端按错误约定回的 */
export type RequestFailure
  /** 断网 */
  = | { kind: 'offline' }
  /** 联网了，但请求没到 Campanula 的服务端 */
    | { kind: 'unreachable' }
  /** Campanula 的服务端出错，没按错误约定回 */
    | { kind: 'serverError' }
    | ApiError

export type Result<T> = { ok: true, value: T } | { ok: false, failure: RequestFailure }

export interface Api {
  get: <T>(path: string) => Promise<Result<T>>
  post: <T>(path: string, body?: unknown) => Promise<Result<T>>
}

function isErrorBody(body: unknown): body is ErrorBody {
  return typeof body === 'object' && body !== null && 'error' in body
    && typeof body.error === 'object' && body.error !== null && 'kind' in body.error
}

/** Campanula 服务端的接口：同源，浏览器自动带上登录 Cookie；请求和响应都是 JSON */
export function createApi(browser: Pick<BrowserCapabilities, 'fetch' | 'network'>): Api {
  // fetch 和读响应体只在网络出错时抛 TypeError（Fetch 标准的 network error），其他错误照常抛出
  const networkFailure = (error: unknown): Result<never> => {
    if (!(error instanceof TypeError))
      throw error
    return { ok: false, failure: { kind: browser.network.onLine ? 'unreachable' : 'offline' } }
  }

  async function request<T>(path: string, init?: RequestInit): Promise<Result<T>> {
    let response: Response
    try {
      response = await browser.fetch(path, init)
    }
    catch (error) {
      return networkFailure(error)
    }
    let body: unknown
    try {
      body = await response.json()
    }
    catch (error) {
      if (!(error instanceof SyntaxError))
        return networkFailure(error)
      // 回了 200 却不是 JSON：中间的代理或强制门户（例如公共 Wi-Fi 的登录页）替服务端回的，没到 Campanula
      return { ok: false, failure: { kind: response.ok ? 'unreachable' : 'serverError' } }
    }
    if (response.ok)
      return { ok: true, value: body as T }
    return { ok: false, failure: isErrorBody(body) ? body.error : { kind: 'serverError' } }
  }

  return {
    get: path => request(path),
    post: (path, body) => request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }),
  }
}
