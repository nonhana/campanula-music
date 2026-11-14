import { endpoints } from '#lib/api/endpoints.ts';
import { deletePlaylist } from '#lib/server/netease/playlist.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ params, cookies, request }) => {
  const { id } = params;
  return respondSignedIn(
    endpoints.deletePlaylist,
    { cookies, request },
    (config) => deletePlaylist(id, config),
  );
};
