// NoInfer 守卫下，路由回调里内联返回带字面量字段的对象要写 as const
export interface Endpoint<Response> {
  readonly method: 'GET' | 'POST';
  readonly takesParams: boolean;
  readonly path: (params: never) => string;
  readonly response?: Response;
}

export interface GetEndpoint<Params, Response> extends Endpoint<Response> {
  readonly method: 'GET';
  readonly path: (params: Params) => string;
}

export interface PostEndpoint<
  Params,
  Request,
  Response,
> extends Endpoint<Response> {
  readonly method: 'POST';
  readonly path: (params: Params) => string;
  readonly request?: Request;
}

export const get = <Response, Params = void>(
  path: (params: Params) => string,
): GetEndpoint<Params, Response> => ({
  method: 'GET',
  takesParams: path.length > 0,
  path,
});

export const post = <Response, Request = void, Params = void>(
  path: (params: Params) => string,
): PostEndpoint<Params, Request, Response> => ({
  method: 'POST',
  takesParams: path.length > 0,
  path,
});
