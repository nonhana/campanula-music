import type { CheckTokens } from '#lib/api/check-token.js';
import {
  CHECK_TOKEN,
  CHECK_TOKENS_HEADER,
  RENEWAL_ATTEMPTED_HEADER,
  RENEWAL_REQUIRED_HEADER,
} from '#lib/api/check-token.js';
import type { GetEndpoint, PostEndpoint } from '#lib/api/endpoint.js';
import { endpoints } from '#lib/api/endpoints.js';
import type { ApiError, ErrorBody } from '#lib/api/errors.js';
import { LOGIN_COOKIE_LOCK } from '#lib/api/login.js';

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
  browser: Pick<
    BrowserCapabilities,
    'fetch' | 'network' | 'checkToken' | 'locks'
  >,
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
    {
      tokenCount = 0,
      renewalAttempted = false,
      loginCookieLocked = false,
    }: {
      tokenCount?: number;
      renewalAttempted?: boolean;
      loginCookieLocked?: boolean;
    } = {},
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
    if (mine !== currentRound())
      return { ok: false, failure: { kind: 'needsLogin' } };
    if (tokens.requests.length || renewalAttempted) {
      const headers = new Headers(init?.headers);
      if (tokens.requests.length)
        headers.set(CHECK_TOKENS_HEADER, JSON.stringify(tokens));
      if (renewalAttempted) headers.set(RENEWAL_ATTEMPTED_HEADER, '1');
      init = { ...init, headers };
    }
    let response: Response;
    try {
      const send = () =>
        mine === currentRound() ? browser.fetch(path, init) : null;
      const received =
        path === endpoints.renewSession.path(undefined) && !loginCookieLocked
          ? await browser.locks.request(LOGIN_COOKIE_LOCK, send)
          : await send();
      if (!received) return { ok: false, failure: { kind: 'needsLogin' } };
      response = received;
    } catch (error) {
      return networkFailure(error);
    }
    const renewal = response.headers.get(RENEWAL_REQUIRED_HEADER);
    if (
      response.status === 428 &&
      !renewalAttempted &&
      (renewal === 'due' || renewal === 'expired')
    ) {
      if (mine !== currentRound())
        return { ok: false, failure: { kind: 'needsLogin' } };
      const renewed = await request(
        endpoints.renewSession.path(undefined),
        { method: endpoints.renewSession.method },
        {
          tokenCount: endpoints.renewSession.checkTokens,
          renewalAttempted: true,
          // 账号检查由 App 持有同一把锁，不能嵌套申请。
          loginCookieLocked: path === endpoints.account.path(undefined),
        },
      );
      if (
        !renewed.ok &&
        (renewal === 'expired' || renewed.failure.kind === 'needsLogin')
      )
        return renewed;
      if (mine !== currentRound())
        return { ok: false, failure: { kind: 'needsLogin' } };
      if (!renewed.ok && renewed.failure.kind === 'checkTokenUnavailable')
        console.warn('主动续期失败：安全验证不可用');
      return request<Value>(path, init, { tokenCount, renewalAttempted: true });
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
      { tokenCount: endpoint.checkTokens },
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
      {
        tokenCount:
          endpoint.needsCheckToken && !endpoint.needsCheckToken(body as Request)
            ? 0
            : endpoint.checkTokens,
      },
    );
  };

  return { get, post };
};
