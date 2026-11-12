import { endpoints } from '#lib/api/endpoints.js';
import { clearLogin, readLogin } from '#lib/server/credentials.js';
import { configFor } from '#lib/server/netease/config.js';
import { failureOf, logFailure } from '#lib/server/netease/failure.js';
import { logout } from '#lib/server/netease/login.js';
import { json } from '#lib/server/respond.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ cookies }) => {
  const login = readLogin(cookies);
  if (login?.session) {
    try {
      await logout(configFor(login.deviceId, login.session.credentials));
    } catch (error) {
      const failure = failureOf(error);
      if (!failure) throw error;
      logFailure(error, failure);
    }
  }
  clearLogin(cookies);
  return json(endpoints.logout, { signedOut: true });
};
