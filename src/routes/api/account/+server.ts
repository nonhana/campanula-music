import { endpoints } from '#lib/api/endpoints.js';
import { readLogin } from '#lib/server/credentials.js';
import { fetchAccount } from '#lib/server/netease/login.js';
import { readCheckTokens } from '#lib/server/request.js';
import { json, withNetease } from '#lib/server/respond.js';
import { asSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ cookies, request }) => {
  const login = readLogin(cookies);
  if (!login?.session) return json(endpoints.account, { account: null });
  const signedIn = { ...login, session: login.session };
  return withNetease(endpoints.account, async () => ({
    account: await asSignedIn(cookies, signedIn, fetchAccount, {
      tokens: readCheckTokens(request),
      renewIfDue: true,
      retryRead: true,
    }),
  }));
};
