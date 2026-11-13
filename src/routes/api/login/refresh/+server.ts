import { endpoints } from '#lib/api/endpoints.js';
import { saveLogin } from '#lib/server/credentials.js';
import { credentialsFrom } from '#lib/server/netease/cookies.js';
import { renewLogin } from '#lib/server/netease/login.js';
import { respondSignedIn } from '#lib/server/session.js';

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
