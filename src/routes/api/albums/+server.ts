import { endpoints } from '#lib/api/endpoints.ts';
import { fetchCollectedAlbums } from '#lib/server/netease/library.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ cookies, request }) =>
  respondSignedIn(
    endpoints.albums,
    { cookies, request },
    async (config) => ({
      albums: await fetchCollectedAlbums(config),
    }),
    { retryRead: true },
  );
