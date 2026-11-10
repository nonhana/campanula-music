import { endpoints } from '#lib/api/endpoints.js';
import { collectPlaylist } from '#lib/server/netease.js';
import { readPlaylistCollect } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const change = await readPlaylistCollect(request);
  return respondSignedIn(endpoints.collectPlaylist, cookies, (listener) =>
    collectPlaylist(id, change, listener),
  );
};
