import { endpoints } from '#lib/api/endpoints.ts';
import { fetchArtistSongs } from '#lib/server/netease/library.ts';
import { readArtistSongOrder, readOffset } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url, cookies, request }) => {
  const { id } = params;
  const order = readArtistSongOrder(url.searchParams.get('order'));
  const offset = readOffset(url.searchParams.get('offset'));
  return respondSignedIn(
    endpoints.artistSongs,
    { cookies, request },
    (config) => fetchArtistSongs(id, order, offset, config),
    { retryRead: true },
  );
};
