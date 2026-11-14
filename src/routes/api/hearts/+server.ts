import { endpoints } from '#lib/api/endpoints.ts';
import { fetchHearts, heart } from '#lib/server/netease/library.ts';
import { readHeart, readId } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, cookies, request }) => {
  const uid = readId('uid', url.searchParams.get('uid'));
  return respondSignedIn(
    endpoints.hearts,
    { cookies, request },
    async (config) => ({
      songIds: await fetchHearts(uid, config),
    }),
    { retryRead: true },
  );
};
export const POST: RequestHandler = async ({ request, cookies }) => {
  const { songId, hearted } = await readHeart(request);
  return respondSignedIn(endpoints.heart, { cookies, request }, (config) =>
    heart(songId, hearted, config),
  );
};
