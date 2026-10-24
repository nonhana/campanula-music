import type { GetEndpoint, PostEndpoint } from '#lib/api/endpoint.js'
import type { ApiError, ErrorBody } from '#lib/api/errors.js'

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

/** 端点没有参数（Params = void）时，调用不传 params */
export type ParamsArg<Params> = [Params] extends [void] ? [] : [params: Params]
/** 端点没有请求体（Request = void）时可以不传 body；要带 options 时写 undefined 占位。有请求体时必传 */
export type BodyArg<Request> = [Request] extends [void] ? [body?: undefined] : [body: Request]

/**
 * keepalive：页面被隐藏（切后台、锁屏、关页面）时也要发出去的请求（晚一点提交的修改）。
 * 请求体超过 64 KiB 的浏览器会拒掉，Api 自己改成普通请求（#70）；调用方只说要 keepalive
 */
export interface PostOptions {
  keepalive?: boolean
}

/** 浏览器只给带 keepalive 的请求 64 KiB 的请求体（Fetch 标准）；按 UTF-8 字节数算 */
const KEEPALIVE_MAX_BYTES = 64 * 1024

const fitsKeepalive = (body: string): boolean => new TextEncoder().encode(body).byteLength <= KEEPALIVE_MAX_BYTES

/** Campanula 服务端的接口，按端点目录（#lib/api/endpoints）调用：网址、请求体和响应类型都来自端点那一条 */
export interface Api {
  get: <Params, Response>(endpoint: GetEndpoint<Params, Response>, ...args: ParamsArg<Params>) => Promise<Result<Response>>
  post: <Params, Request, Response>(endpoint: PostEndpoint<Params, Request, Response>, ...args: [...ParamsArg<Params>, ...BodyArg<Request>, options?: PostOptions]) => Promise<Result<Response>>
}

/** 从端点调用的实参里取 params：没有参数的端点本身是 void，调用时没有这个实参 */
const paramsOf = <Params>(args: readonly unknown[], takesParams = true): Params => (takesParams ? args[0] : undefined) as Params

const isErrorBody = (body: unknown): body is ErrorBody => typeof body === 'object' && body !== null && 'error' in body
  && typeof body.error === 'object' && body.error !== null && 'kind' in body.error

/** Campanula 服务端的接口：同源，浏览器自动带上登录 Cookie；请求和响应都是 JSON */
export const createApi = (browser: Pick<BrowserCapabilities, 'fetch' | 'network'>): Api => {
  // fetch 和读响应体只在网络出错时抛 TypeError（Fetch 标准的 network error），其他错误照常抛出
  const networkFailure = (error: unknown): Result<never> => {
    if (!(error instanceof TypeError))
      throw error
    return {
      ok: false,
      failure: {
        kind: browser.network.onLine ? 'unreachable' : 'offline',
      },
    }
  }

  const request = async <Value>(path: string, init?: RequestInit): Promise<Result<Value>> => {
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
      return {
        ok: false,
        failure: {
          kind: response.ok ? 'unreachable' : 'serverError',
        },
      }
    }
    if (response.ok)
      return { ok: true, value: body as Value }
    return {
      ok: false,
      failure: isErrorBody(body)
        ? body.error
        : { kind: 'serverError' },
    }
  }

  const get = <Params, Response>(endpoint: GetEndpoint<Params, Response>, ...args: ParamsArg<Params>): Promise<Result<Response>> => request<Response>(endpoint.path(paramsOf<Params>(args)), { method: endpoint.method })

  const post = <Params, Request, Response>(endpoint: PostEndpoint<Params, Request, Response>, ...args: [...ParamsArg<Params>, ...BodyArg<Request>, options?: PostOptions]): Promise<Result<Response>> => {
    // 实参依次是 params（端点有参数时）、body、options；没有请求体的端点也留着 body 的位置，options 不会错位
    const given: readonly unknown[] = args
    const offset = endpoint.takesParams ? 1 : 0
    const params = paramsOf<Params>(given, endpoint.takesParams)
    const body = given[offset] as Request | undefined
    const options = given[offset + 1] as PostOptions | undefined
    // 只序列化一次：同一个字符串既算要不要 keepalive，也作为请求体发出去
    const serialized = JSON.stringify(body ?? {})
    return request<Response>(endpoint.path(params), {
      method: endpoint.method,
      headers: { 'content-type': 'application/json' },
      body: serialized,
      keepalive: options?.keepalive === true && fitsKeepalive(serialized),
    })
  }

  return { get, post }
}
