import { endpoints } from '#lib/api/endpoints.js';
import { fetchPlaylistTags } from '#lib/server/netease/playlist.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ cookies }) =>
  respondSignedIn(endpoints.playlistTags, cookies, async (listener) => ({
    groups: await fetchPlaylistTags(listener),
  }));
