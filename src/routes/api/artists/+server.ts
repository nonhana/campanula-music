import { endpoints } from '#lib/api/endpoints.ts';
import { fetchCollectedArtists } from '#lib/server/netease/library.ts';
import { respondSignedIn } from '#lib/server/session.ts';

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
