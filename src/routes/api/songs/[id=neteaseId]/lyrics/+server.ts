import { endpoints } from '#lib/api/endpoints.js';
import { fetchLyrics } from '#lib/server/netease/player.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ params, cookies }) => {
  const { id } = params;
  return respondSignedIn(endpoints.lyrics, cookies, (listener) =>
    fetchLyrics(id, listener),
  );
};
