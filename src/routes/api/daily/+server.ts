import { endpoints } from '#lib/api/endpoints.js';
import { fetchDaily } from '#lib/server/netease/library.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ cookies, request }) =>
  respondSignedIn(
    endpoints.daily,
    { cookies, request },
    (config) => fetchDaily(config),
    {
      retryRead: true,
    },
  );
