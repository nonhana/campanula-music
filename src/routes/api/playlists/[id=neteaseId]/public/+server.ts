import { endpoints } from '#lib/api/endpoints.js';
import { publishPlaylist } from '#lib/server/netease/playlist.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = ({ params, cookies }) => {
  const { id } = params;
  return respondSignedIn(endpoints.publishPlaylist, cookies, (listener) =>
    publishPlaylist(id, listener),
  );
};
