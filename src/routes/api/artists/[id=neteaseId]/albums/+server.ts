import { endpoints } from '#lib/api/endpoints.js';
import { fetchArtistAlbums } from '#lib/server/netease/library.js';
import { readOffset } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ params, url, cookies, request }) => {
  const { id } = params;
  const offset = readOffset(url.searchParams.get('offset'));
  return respondSignedIn(
    endpoints.artistAlbums,
    { cookies, request },
    (config) => fetchArtistAlbums(id, offset, config),
    { retryRead: true },
  );
};
