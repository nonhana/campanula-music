import { endpoints } from '#lib/api/endpoints.js';
import { fetchCollectedAlbums } from '#lib/server/netease/library.js';
import { respondSignedIn } from '#lib/server/session.js';

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
