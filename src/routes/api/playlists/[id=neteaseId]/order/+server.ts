import { endpoints } from '#lib/api/endpoints.ts';
import { SONGS_PER_ORDER } from '#lib/api/library.ts';
import { updateSongOrder } from '#lib/server/netease/playlist.ts';
import { readIds } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const songIds = await readIds(
    endpoints.songOrder,
    request,
    'songIds',
    SONGS_PER_ORDER,
  );
  return respondSignedIn(endpoints.songOrder, { cookies, request }, (config) =>
    updateSongOrder(id, songIds, config),
  );
};
