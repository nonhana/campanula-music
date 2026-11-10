import type { Cookies } from '@sveltejs/kit';

import type { Endpoint } from '#lib/api/endpoint.js';

import type { LoginCookie } from './credentials';
import { readLogin, renewalDue, saveLogin } from './credentials';
import type { Listener, SignedInListener } from './netease';
import { renewLogin } from './netease';
import { NeteaseError } from './netease-error';
import { errorResponse, withNetease } from './respond';

export type SignedIn = LoginCookie & {
  session: NonNullable<LoginCookie['session']>;
};

// renewIfDue 只给打开 App 时问当前账号的请求用：续期走 Web Locks，同一浏览器的标签页不会同时续期
export const asSignedIn = async <T>(
  cookies: Cookies,
  login: SignedIn,
  call: (listener: Listener) => Promise<T>,
  { renewIfDue = false } = {},
): Promise<T> => {
  let listener: SignedInListener = {
    deviceId: login.deviceId,
    credentials: login.session.credentials,
  };
  let renewed = false;
  const renew = async (): Promise<void> => {
    listener = { ...listener, credentials: await renewLogin(listener) };
    saveLogin(cookies, listener.deviceId, listener.credentials);
    renewed = true;
  };
  const needsLogin = (error: unknown) =>
    error instanceof NeteaseError && error.failure.kind === 'needsLogin';

  if (renewIfDue && renewalDue(login.session)) {
    await renew().catch((error: unknown) => {
      if (!(error instanceof NeteaseError) || needsLogin(error)) throw error;
    });
  }
  try {
    return await call(listener);
  } catch (error) {
    if (renewed || !needsLogin(error)) throw error;
    await renew();
    return call(listener);
  }
};

export const respondSignedIn = async <Value>(
  endpoint: Endpoint<Value>,
  cookies: Cookies,
  call: (listener: Listener) => NoInfer<Value> | Promise<NoInfer<Value>>,
): Promise<Response> => {
  const login = readLogin(cookies);
  if (!login?.session) return errorResponse({ kind: 'needsLogin' });
  const signedIn = { ...login, session: login.session };
  return withNetease(endpoint, () =>
    asSignedIn(cookies, signedIn, async (listener) => call(listener)),
  );
};
