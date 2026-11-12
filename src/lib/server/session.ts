import type { Cookies } from '@sveltejs/kit';
import type { ModuleCallConfig } from 'hana-music-api';

import type { Endpoint } from '#lib/api/endpoint.js';

import type { LoginCookie } from './credentials';
import { readLogin, renewalDue, saveLogin } from './credentials';
import { configFor } from './netease/config';
import { credentialsFrom } from './netease/cookies';
import { failureOf, logFailure } from './netease/failure';
import { renewLogin } from './netease/login';
import { errorResponse, withNetease } from './respond';

export type SignedIn = LoginCookie & {
  session: NonNullable<LoginCookie['session']>;
};

type ReadStep = <T>(
  read: (config: ModuleCallConfig) => Promise<T>,
) => Promise<T>;

interface SessionOptions {
  retryRead?: boolean;
  renewIfDue?: boolean;
}

// renewIfDue 只给打开 App 时问当前账号的请求用：续期走 Web Locks，同一浏览器的标签页不会同时续期
export const asSignedIn = async <T>(
  cookies: Cookies,
  login: SignedIn,
  call: (config: ModuleCallConfig, read: ReadStep) => Promise<T>,
  { renewIfDue = false, retryRead = false }: SessionOptions = {},
): Promise<T> => {
  let credentials = login.session.credentials;
  let config = configFor(login.deviceId, credentials);
  let renewed = false;
  const renew = async (): Promise<void> => {
    credentials = credentialsFrom(
      'login_refresh',
      await renewLogin(config),
      credentials,
    );
    config = configFor(login.deviceId, credentials);
    saveLogin(cookies, login.deviceId, credentials);
    renewed = true;
  };
  const needsLogin = (error: unknown) =>
    failureOf(error)?.kind === 'needsLogin';

  if (renewIfDue && renewalDue(login.session)) {
    await renew().catch((error: unknown) => {
      const failure = failureOf(error);
      if (!failure || needsLogin(error)) throw error;
      logFailure(error, failure);
    });
  }
  const read: ReadStep = async (step) => {
    try {
      return await step(config);
    } catch (error) {
      if (renewed || !needsLogin(error)) throw error;
      await renew();
      return step(config);
    }
  };
  return retryRead
    ? read((snapshot) => call(snapshot, read))
    : call(config, read);
};

export const respondSignedIn = async <Value>(
  endpoint: Endpoint<Value>,
  cookies: Cookies,
  call: (
    config: ModuleCallConfig,
    read: ReadStep,
  ) => NoInfer<Value> | Promise<NoInfer<Value>>,
  options: SessionOptions = {},
): Promise<Response> => {
  const login = readLogin(cookies);
  if (!login?.session) return errorResponse({ kind: 'needsLogin' });
  const signedIn = { ...login, session: login.session };
  return withNetease(endpoint, () =>
    asSignedIn(
      cookies,
      signedIn,
      async (config, read) => call(config, read),
      options,
    ),
  );
};
