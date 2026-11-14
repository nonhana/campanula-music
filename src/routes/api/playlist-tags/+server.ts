import { endpoints } from '#lib/api/endpoints.ts';
import { fetchPlaylistTags } from '#lib/server/netease/playlist.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ cookies, request }) =>
  respondSignedIn(
    endpoints.playlistTags,
    { cookies, request },
    async (config) => ({
      groups: await fetchPlaylistTags(config),
    }),
    { retryRead: true },
  );
