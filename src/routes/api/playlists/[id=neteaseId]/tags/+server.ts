import { endpoints } from '#lib/api/endpoints.js';
import { tagPlaylist } from '#lib/server/netease/playlist.js';
import { readPlaylistTags } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const { tags } = await readPlaylistTags(request);
  return respondSignedIn(
    endpoints.tagPlaylist,
    { cookies, request },
    (config) => tagPlaylist(id, tags, config),
  );
};
