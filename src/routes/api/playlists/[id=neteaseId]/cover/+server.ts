import { endpoints } from '#lib/api/endpoints.ts';
import { setPlaylistCover } from '#lib/server/netease/playlist.ts';
import { readCoverImage } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const { imgId } = await readCoverImage(request);
  return respondSignedIn(endpoints.setCover, { cookies, request }, (config) =>
    setPlaylistCover(id, imgId, config),
  );
};
