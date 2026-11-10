import { endpoints } from '#lib/api/endpoints.js';
import { fetchPlaylistPage } from '#lib/server/netease.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, cookies }) => {
  const { id } = params;
  return respondSignedIn(endpoints.playlist, cookies, (listener) =>
    fetchPlaylistPage(id, listener),
  );
};
