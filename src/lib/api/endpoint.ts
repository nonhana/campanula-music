/**
 * 端点目录里的一条：方法、拼路径的函数（参数和关键词编码都在这里）、请求体和响应类型。
 * 请求体、响应类型只在编译期存在（可选字段，运行时没有值）：浏览器只打包拼路径的小函数，不打包 Effect（ADR-0005）。
 * 服务端的 NoInfer 守卫下，路由回调里内联返回带字面量字段的对象时要写 `as const`（例如 captcha 的 `{ sent: true }`）。
 */
export interface Endpoint<Response> {
  readonly method: 'GET' | 'POST'
  /** 有没有参数：Api 据此把调用实参分成 params 和请求体（见 src/lib/app/api-client.ts） */
  readonly takesParams: boolean
  readonly path: (params: never) => string
  /** 只在编译期用 */
  readonly response?: Response
}

/** GET 端点：params 是路径和查询参数 */
export interface GetEndpoint<Params, Response> extends Endpoint<Response> {
  readonly method: 'GET'
  readonly path: (params: Params) => string
}

/** POST 端点：params 是路径和查询参数，Request 是请求体 */
export interface PostEndpoint<Params, Request, Response> extends Endpoint<Response> {
  readonly method: 'POST'
  readonly path: (params: Params) => string
  /** 只在编译期用 */
  readonly request?: Request
}

/**
 * GET 端点。Response 从条目推出；没有参数时 Params 不写。
 * 泛型顺序是 Response 在前：Request/Params 有默认值，TypeScript 不允许必填类型参数跟在有默认值的后面（TS2706）。
 * 目录里没有参数的条目写 `() => …`，有参数的写 `(params) => …`：takesParams 由 path 的参数个数得出。
 */
export const get = <Response, Params = void>(path: (params: Params) => string): GetEndpoint<Params, Response> => ({ method: 'GET', takesParams: path.length > 0, path })

/**
 * POST 端点。Response 从条目推出；没有请求体时 Request 不写，没有参数时 Params 不写。
 * 泛型顺序是 Response 在前：Request/Params 有默认值，TypeScript 不允许必填类型参数跟在有默认值的后面（TS2706）。
 * 目录里没有参数的条目写 `() => …`，有参数的写 `(params) => …`：takesParams 由 path 的参数个数得出。
 */
export const post = <Response, Request = void, Params = void>(path: (params: Params) => string): PostEndpoint<Params, Request, Response> => ({ method: 'POST', takesParams: path.length > 0, path })
