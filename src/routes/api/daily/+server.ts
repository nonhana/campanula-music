import { endpoints } from '#lib/api/endpoints.ts';
import { fetchDaily } from '#lib/server/netease/library.ts';
import { respondSignedIn } from '#lib/server/session.ts';

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
