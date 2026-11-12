import { endpoints } from '#lib/api/endpoints.js';
import { describePlaylist } from '#lib/server/netease/playlist.js';
import { readPlaylistDescription } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const { description } = await readPlaylistDescription(request);
  return respondSignedIn(endpoints.describePlaylist, cookies, (config) =>
    describePlaylist(id, description, config),
  );
};
