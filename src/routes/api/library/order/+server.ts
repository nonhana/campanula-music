import { endpoints } from '#lib/api/endpoints.js';
import { PLAYLISTS_PER_ORDER } from '#lib/api/library.js';
import { updatePlaylistOrder } from '#lib/server/netease/playlist.js';
import { readIds } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

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
