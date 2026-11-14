import { endpoints } from '#lib/api/endpoints.ts';
import { fetchArtist } from '#lib/server/netease/library.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ params, cookies, request }) => {
  const { id } = params;
  return respondSignedIn(
    endpoints.artist,
    { cookies, request },
    (config) => fetchArtist(id, config),
    { retryRead: true },
  );
};
