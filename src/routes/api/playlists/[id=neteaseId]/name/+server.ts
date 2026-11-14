import { endpoints } from '#lib/api/endpoints.ts';
import { renamePlaylist } from '#lib/server/netease/playlist.ts';
import { readPlaylistRename } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

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
