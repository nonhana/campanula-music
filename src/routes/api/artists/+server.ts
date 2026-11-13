import { endpoints } from '#lib/api/endpoints.js';
import { fetchCollectedArtists } from '#lib/server/netease/library.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ cookies, request }) =>
  respondSignedIn(
    endpoints.artists,
    { cookies, request },
    async (config) => ({
      artists: await fetchCollectedArtists(config),
    }),
    { retryRead: true },
  );
