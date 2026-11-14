import { endpoints } from '#lib/api/endpoints.ts';
import { fetchPlaylistPage } from '#lib/server/netease/playlist.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, cookies, request }) => {
  const { id } = params;
  return respondSignedIn(
    endpoints.playlist,
    { cookies, request },
    (config) => fetchPlaylistPage(id, config),
    { retryRead: true },
  );
};
