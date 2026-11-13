import { error } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import type { ModuleCallConfig } from 'hana-music-api';

import type { CheckTokens } from '#lib/api/check-token.js';
import { RENEWAL_ATTEMPTED_HEADER } from '#lib/api/check-token.js';
import type { Endpoint } from '#lib/api/endpoint.js';

import type { LoginCookie } from './credentials';
import { readLogin, renewalDue } from './credentials';
import { configFor } from './netease/config';
import { failureOf, NeteaseError } from './netease/failure';
import { readCheckTokens } from './request';
import { errorResponse, RenewalRequired, withNetease } from './respond';

export type SignedIn = LoginCookie & {
  session: NonNullable<LoginCookie['session']>;
};

interface SessionOptions {
  retryRead?: boolean;
  renewIfDue?: boolean;
  checkTokenRequired?: boolean;
  tokens?: CheckTokens;
  renewalAttempted?: boolean;
}

export const asSignedIn = async <T>(
  login: SignedIn,
  call: (config: ModuleCallConfig, login: SignedIn) => Promise<T>,
  {
    renewIfDue = false,
    retryRead = false,
    tokens = { requests: [] },
    renewalAttempted = false,
  }: SessionOptions = {},
): Promise<T> => {
  if (renewIfDue && !renewalAttempted && renewalDue(login.session))
    throw new RenewalRequired('due');
  const pendingTokens = [...tokens.requests];
  const nextToken = async (): Promise<string> => {
    const token = pendingTokens.shift();
    if (!token) throw new NeteaseError({ kind: 'checkTokenUnavailable' });
    return token;
  };
  const config = {
    ...configFor(login.deviceId, login.session.credentials),
    ...(pendingTokens.length ? { checkToken: nextToken } : {}),
  };
  try {
    return await call(config, login);
  } catch (error) {
    if (
      retryRead &&
      !renewalAttempted &&
      failureOf(error)?.kind === 'needsLogin'
    )
      throw new RenewalRequired('expired');
    throw error;
  }
};

export const respondSignedIn = async <Value>(
  endpoint: Endpoint<Value>,
  { cookies, request }: { cookies: Cookies; request: Request },
  call: (
    config: ModuleCallConfig,
    login: SignedIn,
  ) => NoInfer<Value> | Promise<NoInfer<Value>>,
  options: SessionOptions = {},
): Promise<Response> => {
  const login = readLogin(cookies);
  if (!login?.session) return errorResponse({ kind: 'needsLogin' });
  const tokens = readCheckTokens(request);
  const required =
    options.checkTokenRequired === false ? 0 : endpoint.checkTokens;
  if (tokens.requests.length < required) error(400, '要有安全验证令牌');
  const signedIn = { ...login, session: login.session };
  return withNetease(endpoint, () =>
    asSignedIn(signedIn, async (config) => call(config, signedIn), {
      ...options,
      renewalAttempted: request.headers.get(RENEWAL_ATTEMPTED_HEADER) === '1',
      tokens: { ...tokens, requests: tokens.requests.slice(0, required) },
    }),
  );
};
