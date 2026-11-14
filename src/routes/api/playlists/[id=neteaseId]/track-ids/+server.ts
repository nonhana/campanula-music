import { endpoints } from '#lib/api/endpoints.ts';
import { fetchTrackIds } from '#lib/server/netease/playlist.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, cookies, request }) => {
  const { id } = params;
  return respondSignedIn(
    endpoints.trackIds,
    { cookies, request },
    async (config) => ({
      trackIds: await fetchTrackIds(id, config),
    }),
    { retryRead: true },
  );
};
