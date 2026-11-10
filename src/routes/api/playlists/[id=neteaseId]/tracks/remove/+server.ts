import { endpoints } from '#lib/api/endpoints.js';
import { TRACKS_PER_CHANGE } from '#lib/api/library.js';
import { removeTracks } from '#lib/server/netease.js';
import { readIds } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const songIds = await readIds(
    endpoints.removeTracks,
    request,
    'songIds',
    TRACKS_PER_CHANGE,
  );
  return respondSignedIn(endpoints.removeTracks, cookies, (listener) =>
    removeTracks(id, songIds, listener),
  );
};
