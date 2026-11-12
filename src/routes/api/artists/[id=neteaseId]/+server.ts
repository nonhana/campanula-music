import { endpoints } from '#lib/api/endpoints.js';
import { fetchArtist } from '#lib/server/netease/library.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ params, cookies }) => {
  const { id } = params;
  return respondSignedIn(endpoints.artist, cookies, (listener) =>
    fetchArtist(id, listener),
  );
};
