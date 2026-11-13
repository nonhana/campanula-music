import { endpoints } from '#lib/api/endpoints.js';
import { renamePlaylist } from '#lib/server/netease/playlist.js';
import { readPlaylistRename } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const { name } = await readPlaylistRename(request);
  return respondSignedIn(
    endpoints.renamePlaylist,
    { cookies, request },
    (config) => renamePlaylist(id, name, config),
  );
};
