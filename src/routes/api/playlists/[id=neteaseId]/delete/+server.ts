import { endpoints } from '#lib/api/endpoints.js';
import { deletePlaylist } from '#lib/server/netease.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ params, cookies }) => {
  const { id } = params;
  return respondSignedIn(endpoints.deletePlaylist, cookies, (listener) =>
    deletePlaylist(id, listener),
  );
};
