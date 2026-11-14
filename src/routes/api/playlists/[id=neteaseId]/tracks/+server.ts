import { endpoints } from '#lib/api/endpoints.ts';
import { TRACKS_PER_CHANGE } from '#lib/api/library.ts';
import { addTracks } from '#lib/server/netease/playlist.ts';
import { readIds } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const songIds = await readIds(
    endpoints.addTracks,
    request,
    'songIds',
    TRACKS_PER_CHANGE,
  );
  return respondSignedIn(endpoints.addTracks, { cookies, request }, (config) =>
    addTracks(id, songIds, config),
  );
};
