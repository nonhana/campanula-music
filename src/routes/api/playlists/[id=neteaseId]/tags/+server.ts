import { endpoints } from '#lib/api/endpoints.ts';
import { tagPlaylist } from '#lib/server/netease/playlist.ts';
import { readPlaylistTags } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

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
