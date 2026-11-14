import { endpoints } from '#lib/api/endpoints.ts';
import { fetchCreatedPlaylist } from '#lib/server/netease/playlist.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ cookies, request, params }) => {
  const id = params.id;
  return respondSignedIn(
    endpoints.createdPlaylist,
    { cookies, request },
    async (config) => ({ playlist: await fetchCreatedPlaylist(id, config) }),
    { retryRead: true },
  );
};
