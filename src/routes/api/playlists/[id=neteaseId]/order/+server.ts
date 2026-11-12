import { endpoints } from '#lib/api/endpoints.js';
import { SONGS_PER_ORDER } from '#lib/api/library.js';
import { updateSongOrder } from '#lib/server/netease/playlist.js';
import { readIds } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const songIds = await readIds(
    endpoints.songOrder,
    request,
    'songIds',
    SONGS_PER_ORDER,
  );
  return respondSignedIn(endpoints.songOrder, cookies, (listener) =>
    updateSongOrder(id, songIds, listener),
  );
};
