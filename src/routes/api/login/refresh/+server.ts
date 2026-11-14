import { endpoints } from '#lib/api/endpoints.ts';
import { saveLogin } from '#lib/server/credentials.ts';
import { credentialsFrom } from '#lib/server/netease/cookies.ts';
import { renewLogin } from '#lib/server/netease/login.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies, request }) =>
  respondSignedIn(
    endpoints.renewSession,
    { cookies, request },
    async (config, login) => {
      const credentials = credentialsFrom(
        'login_refresh',
        await renewLogin(config),
        login.session.credentials,
      );
      saveLogin(cookies, login.deviceId, credentials);
      return { renewed: true as const };
    },
  );
