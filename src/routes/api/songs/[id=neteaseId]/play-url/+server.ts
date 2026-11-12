import { endpoints } from '#lib/api/endpoints.js';
import { fetchPlayUrl } from '#lib/server/netease/player.js';
import { readQuality } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ params, url, cookies }) => {
  const { id } = params;
  const quality = readQuality(url.searchParams.get('quality'));
  return respondSignedIn(
    endpoints.playUrl,
    cookies,
    (config) => fetchPlayUrl(id, quality, config),
    { retryRead: true },
  );
};
