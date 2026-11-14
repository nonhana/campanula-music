import { endpoints } from '#lib/api/endpoints.ts';
import { describePlaylist } from '#lib/server/netease/playlist.ts';
import { readPlaylistDescription } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const { description } = await readPlaylistDescription(request);
  return respondSignedIn(
    endpoints.describePlaylist,
    { cookies, request },
    (config) => describePlaylist(id, description, config),
  );
};
