import { RENEWAL_ATTEMPTED_HEADER } from '#lib/api/check-token.ts';
import { endpoints } from '#lib/api/endpoints.ts';
import { readLogin } from '#lib/server/credentials.ts';
import { fetchAccount } from '#lib/server/netease/login.ts';
import { readCheckTokens } from '#lib/server/request.ts';
import { json, withNetease } from '#lib/server/respond.ts';
import { asSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ cookies, request }) => {
  const login = readLogin(cookies);
  if (!login?.session) return json(endpoints.account, { account: null });
  const signedIn = { ...login, session: login.session };
  return withNetease(endpoints.account, async () => ({
    account: await asSignedIn(signedIn, fetchAccount, {
      tokens: readCheckTokens(request),
      renewIfDue: true,
      retryRead: true,
      renewalAttempted: request.headers.get(RENEWAL_ATTEMPTED_HEADER) === '1',
    }),
  }));
};
