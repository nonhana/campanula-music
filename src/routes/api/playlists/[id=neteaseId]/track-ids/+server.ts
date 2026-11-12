import { endpoints } from '#lib/api/endpoints.js';
import { fetchTrackIds } from '#lib/server/netease/playlist.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ params, cookies }) => {
  const { id } = params;
  return respondSignedIn(
    endpoints.trackIds,
    cookies,
    async (config) => ({
      trackIds: await fetchTrackIds(id, config),
    }),
    { retryRead: true },
  );
};
