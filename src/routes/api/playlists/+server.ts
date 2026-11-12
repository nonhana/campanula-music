import { endpoints } from '#lib/api/endpoints.js';
import {
  createPlaylist,
  fetchCreatedPlaylist,
  fetchPlaylists,
} from '#lib/server/netease/playlist.js';
import { readId, readPlaylistDraft } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ url, cookies }) => {
  const uid = readId('uid', url.searchParams.get('uid'));
  return respondSignedIn(
    endpoints.playlists,
    cookies,
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
    cookies,
    async (config, read) => {
      const id = await createPlaylist(draft.name, draft.private, config);
      return {
        playlist: await read((snapshot) => fetchCreatedPlaylist(id, snapshot)),
      };
    },
  );
};
