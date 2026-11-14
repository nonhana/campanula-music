import { endpoints } from '#lib/api/endpoints.ts';
import { collectPlaylist } from '#lib/server/netease/playlist.ts';
import { readCollect } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

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
