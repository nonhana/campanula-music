import { endpoints } from '#lib/api/endpoints.ts';
import { fetchArtistAlbums } from '#lib/server/netease/library.ts';
import { readOffset } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

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
