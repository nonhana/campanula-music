import { endpoints } from '#lib/api/endpoints.ts';
import { fetchPlayUrl } from '#lib/server/netease/player.ts';
import { readQuality } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url, cookies, request }) => {
  const { id } = params;
  const quality = readQuality(url.searchParams.get('quality'));
  return respondSignedIn(
    endpoints.playUrl,
    { cookies, request },
    (config) => fetchPlayUrl(id, quality, config),
    { retryRead: true },
  );
};
