/**
 * 端点目录里的一条：方法、拼路径的函数（参数和关键词编码都在这里）、请求体和响应类型；后两者只在编译期存在，
 * 浏览器只打包拼路径的小函数（ADR-0005）。NoInfer 守卫下，路由回调里内联返回带字面量字段的对象要写 `as const`。
 */
export interface Endpoint<Response> {
  readonly method: 'GET' | 'POST'
  /** 有没有参数：Api 据此把调用实参分成 params 和请求体（见 src/lib/app/api-client.ts） */
  readonly takesParams: boolean
  readonly path: (params: never) => string
  readonly response?: Response
}

/** params 是路径和查询参数 */
export interface GetEndpoint<Params, Response> extends Endpoint<Response> {
  readonly method: 'GET'
  readonly path: (params: Params) => string
}

/** params 是路径和查询参数，Request 是请求体 */
export interface PostEndpoint<Params, Request, Response> extends Endpoint<Response> {
  readonly method: 'POST'
  readonly path: (params: Params) => string
  readonly request?: Request
}

/** Response 在前是因为 Request/Params 有默认值，必填类型参数不能跟在默认值后面（TS2706）；takesParams 由 path 的参数个数得出 */
export const get = <Response, Params = void>(path: (params: Params) => string): GetEndpoint<Params, Response> => ({ method: 'GET', takesParams: path.length > 0, path })

/** Response 在前是因为 Request/Params 有默认值，必填类型参数不能跟在默认值后面（TS2706）；takesParams 由 path 的参数个数得出 */
export const post = <Response, Request = void, Params = void>(path: (params: Params) => string): PostEndpoint<Params, Request, Response> => ({ method: 'POST', takesParams: path.length > 0, path })
