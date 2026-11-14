import { endpoints } from '#lib/api/endpoints.ts';
import { fetchAlbum } from '#lib/server/netease/library.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, cookies, request }) => {
  const { id } = params;
  return respondSignedIn(
    endpoints.album,
    { cookies, request },
    (config) => fetchAlbum(id, config),
    { retryRead: true },
  );
};
