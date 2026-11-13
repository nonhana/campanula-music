import { endpoints } from '#lib/api/endpoints.js';
import { SONGS_PER_REQUEST } from '#lib/api/library.js';
import { fetchSongs } from '#lib/server/netease/library.js';
import { readIds } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request, cookies }) => {
  const ids = await readIds(endpoints.songs, request, 'ids', SONGS_PER_REQUEST);
  return respondSignedIn(
    endpoints.songs,
    { cookies, request },
    async (config) => ({
      songs: await fetchSongs(ids, config),
    }),
    { retryRead: true },
  );
};
