import { endpoints } from '#lib/api/endpoints.ts';
import { PLAYLISTS_PER_ORDER } from '#lib/api/library.ts';
import { updatePlaylistOrder } from '#lib/server/netease/playlist.ts';
import { readIds } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request, cookies }) => {
  const playlistIds = await readIds(
    endpoints.playlistOrder,
    request,
    'playlistIds',
    PLAYLISTS_PER_ORDER,
  );
  return respondSignedIn(
    endpoints.playlistOrder,
    { cookies, request },
    (config) => updatePlaylistOrder(playlistIds, config),
  );
};
