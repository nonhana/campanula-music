// NoInfer 守卫下，路由回调里内联返回带字面量字段的对象要写 as const
export interface Endpoint<Response> {
  readonly method: 'GET' | 'POST';
  readonly takesParams: boolean;
  // 包含受保护只读步骤的重读、SDK 的多请求分支；续期另留一枚。
  readonly checkTokens: number;
  readonly renewalToken: boolean;
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
  readonly needsCheckToken?: (body: Request) => boolean;
}

export const get = <Response, Params = void>(
  path: (params: Params) => string,
  checkTokens = 0,
): GetEndpoint<Params, Response> => ({
  method: 'GET',
  takesParams: path.length > 0,
  checkTokens,
  renewalToken: true,
  path,
});

export const post = <Response, Request = void, Params = void>(
  path: (params: Params) => string,
  options: {
    checkTokens?: number;
    renewalToken?: boolean;
    needsCheckToken?: (body: Request) => boolean;
  } = {},
): PostEndpoint<Params, Request, Response> => ({
  method: 'POST',
  takesParams: path.length > 0,
  checkTokens: options.checkTokens ?? 0,
  renewalToken: options.renewalToken ?? false,
  needsCheckToken: options.needsCheckToken,
  path,
});
