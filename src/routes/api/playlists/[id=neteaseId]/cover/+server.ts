import { endpoints } from '#lib/api/endpoints.js';
import { setPlaylistCover } from '#lib/server/netease/playlist.js';
import { readCoverImage } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const { imgId } = await readCoverImage(request);
  return respondSignedIn(endpoints.setCover, cookies, (config) =>
    setPlaylistCover(id, imgId, config),
  );
};
