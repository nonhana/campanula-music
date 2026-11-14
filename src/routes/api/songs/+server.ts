import { endpoints } from '#lib/api/endpoints.ts';
import { SONGS_PER_REQUEST } from '#lib/api/library.ts';
import { fetchSongs } from '#lib/server/netease/library.ts';
import { readIds } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

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
