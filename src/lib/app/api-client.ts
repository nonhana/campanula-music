import type { CheckTokens } from '#lib/api/check-token.js';
import { CHECK_TOKEN, CHECK_TOKENS_HEADER } from '#lib/api/check-token.js';
import type { GetEndpoint, PostEndpoint } from '#lib/api/endpoint.js';
import type { ApiError, ErrorBody } from '#lib/api/errors.js';

import type { BrowserCapabilities } from './browser';

export type RequestFailure =
  | { kind: 'offline' }
  | { kind: 'unreachable' }
  | { kind: 'serverError' }
  | ApiError;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; failure: RequestFailure };

export type ParamsArg<Params> = [Params] extends [void] ? [] : [params: Params];
export type BodyArg<Request> = [Request] extends [void]
  ? [body?: undefined]
  : [body: Request];

// 调用方只说要 keepalive，请求体超过 64 KiB 时 Api 自己降级成普通请求
export interface PostOptions {
  keepalive?: boolean;
}

// 浏览器只给带 keepalive 的请求 64 KiB 请求体（Fetch 标准），按 UTF-8 字节数算
const KEEPALIVE_MAX_BYTES = 64 * 1024;

const fitsKeepalive = (body: string): boolean =>
  new TextEncoder().encode(body).byteLength <= KEEPALIVE_MAX_BYTES;

export interface Api {
  get: <Params, Response>(
    endpoint: GetEndpoint<Params, Response>,
    ...args: ParamsArg<Params>
  ) => Promise<Result<Response>>;
  post: <Params, Request, Response>(
    endpoint: PostEndpoint<Params, Request, Response>,
    ...args: [...ParamsArg<Params>, ...BodyArg<Request>, options?: PostOptions]
  ) => Promise<Result<Response>>;
}

const paramsOf = <Params>(
  args: readonly unknown[],
  takesParams = true,
): Params => (takesParams ? args[0] : undefined) as Params;

const isErrorBody = (body: unknown): body is ErrorBody =>
  typeof body === 'object' &&
  body !== null &&
  'error' in body &&
  typeof body.error === 'object' &&
  body.error !== null &&
  'kind' in body.error;

export const createApi = (
  browser: Pick<BrowserCapabilities, 'fetch' | 'network' | 'checkToken'>,
  currentRound: () => number,
): Api => {
  const networkFailure = (error: unknown): Result<never> => {
    if (!(error instanceof TypeError)) throw error;
    return {
      ok: false,
      failure: {
        kind: browser.network.onLine ? 'unreachable' : 'offline',
      },
    };
  };

  const request = async <Value>(
    path: string,
    init?: RequestInit,
    tokenCount = 0,
    renewalToken = false,
  ): Promise<Result<Value>> => {
    const mine = currentRound();
    const tokens: CheckTokens = { requests: [] };
    const takeToken = async (): Promise<string> => {
      const token = await browser.checkToken();
      if (!CHECK_TOKEN.test(token)) throw new Error('安全验证没有返回有效令牌');
      return token;
    };
    try {
      for (let i = 0; i < tokenCount; i += 1)
        tokens.requests.push(await takeToken());
    } catch {
      return { ok: false, failure: { kind: 'checkTokenUnavailable' } };
    }
    if (renewalToken) {
      tokens.renewal = await takeToken().catch(() => undefined);
      if (tokenCount > 0 && !tokens.renewal)
        return { ok: false, failure: { kind: 'checkTokenUnavailable' } };
    }
    if (mine !== currentRound())
      return { ok: false, failure: { kind: 'needsLogin' } };
    if (tokens.requests.length || tokens.renewal) {
      const headers = new Headers(init?.headers);
      headers.set(CHECK_TOKENS_HEADER, JSON.stringify(tokens));
      init = { ...init, headers };
    }
    let response: Response;
    try {
      response = await browser.fetch(path, init);
    } catch (error) {
      return networkFailure(error);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) return networkFailure(error);
      return {
        ok: false,
        failure: {
          kind: response.ok ? 'unreachable' : 'serverError',
        },
      };
    }
    if (response.ok) return { ok: true, value: body as Value };
    return {
      ok: false,
      failure: isErrorBody(body) ? body.error : { kind: 'serverError' },
    };
  };

  const get = <Params, Response>(
    endpoint: GetEndpoint<Params, Response>,
    ...args: ParamsArg<Params>
  ): Promise<Result<Response>> =>
    request<Response>(
      endpoint.path(paramsOf<Params>(args)),
      {
        method: endpoint.method,
      },
      endpoint.checkTokens,
      endpoint.renewalToken,
    );

  const post = <Params, Request, Response>(
    endpoint: PostEndpoint<Params, Request, Response>,
    ...args: [...ParamsArg<Params>, ...BodyArg<Request>, options?: PostOptions]
  ): Promise<Result<Response>> => {
    const given: readonly unknown[] = args;
    const offset = endpoint.takesParams ? 1 : 0;
    const params = paramsOf<Params>(given, endpoint.takesParams);
    const body = given[offset] as Request | undefined;
    const options = given[offset + 1] as PostOptions | undefined;
    const serialized = JSON.stringify(body ?? {});
    return request<Response>(
      endpoint.path(params),
      {
        method: endpoint.method,
        headers: { 'content-type': 'application/json' },
        body: serialized,
        keepalive: options?.keepalive === true && fitsKeepalive(serialized),
      },
      endpoint.needsCheckToken && !endpoint.needsCheckToken(body as Request)
        ? 0
        : endpoint.checkTokens,
      endpoint.renewalToken,
    );
  };

  return { get, post };
};
