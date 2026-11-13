import { endpoints } from '#lib/api/endpoints.js';
import { collectPlaylist } from '#lib/server/netease/playlist.js';
import { readCollect } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const change = await readCollect(request);
  return respondSignedIn(
    endpoints.collectPlaylist,
    { cookies, request },
    (config) => collectPlaylist(id, change, config),
    { checkTokenRequired: change.collected },
  );
};
