import { endpoints } from '#lib/api/endpoints.ts';
import {
  createPlaylist,
  fetchPlaylists,
} from '#lib/server/netease/playlist.ts';
import { readId, readPlaylistDraft } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, cookies, request }) => {
  const uid = readId('uid', url.searchParams.get('uid'));
  return respondSignedIn(
    endpoints.playlists,
    { cookies, request },
    async (config) => ({
      playlists: await fetchPlaylists(uid, config),
    }),
    { retryRead: true },
  );
};
export const POST: RequestHandler = async ({ request, cookies }) => {
  const draft = await readPlaylistDraft(request);
  return respondSignedIn(
    endpoints.createPlaylist,
    { cookies, request },
    async (config) => {
      const id = await createPlaylist(draft.name, draft.private, config);
      return { id };
    },
  );
};
