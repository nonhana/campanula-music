import { endpoints } from '#lib/api/endpoints.js';
import { clearLogin, readLogin } from '#lib/server/credentials.js';
import { NeteaseError } from '#lib/server/netease-error.js';
import { logout } from '#lib/server/netease.js';
import { json } from '#lib/server/respond.js';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
  const login = readLogin(cookies);
  if (login?.session) {
    try {
      await logout({
        deviceId: login.deviceId,
        credentials: login.session.credentials,
      });
    } catch (error) {
      if (!(error instanceof NeteaseError)) throw error;
    }
  }
  clearLogin(cookies);
  return json(endpoints.logout, { signedOut: true });
};
