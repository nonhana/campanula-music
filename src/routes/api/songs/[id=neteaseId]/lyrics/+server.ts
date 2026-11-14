import { endpoints } from '#lib/api/endpoints.ts';
import { fetchLyrics } from '#lib/server/netease/player.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, cookies, request }) => {
  const { id } = params;
  return respondSignedIn(
    endpoints.lyrics,
    { cookies, request },
    (config) => fetchLyrics(id, config),
    { retryRead: true },
  );
};
