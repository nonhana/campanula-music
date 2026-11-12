import { endpoints } from '#lib/api/endpoints.js';
import { fetchHearts, heart } from '#lib/server/netease/library.js';
import { readHeart, readId } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ url, cookies }) => {
  const uid = readId('uid', url.searchParams.get('uid'));
  return respondSignedIn(endpoints.hearts, cookies, async (listener) => ({
    songIds: await fetchHearts(uid, listener),
  }));
};
export const POST: RequestHandler = async ({ request, cookies }) => {
  const { songId, hearted } = await readHeart(request);
  return respondSignedIn(endpoints.heart, cookies, (listener) =>
    heart(songId, hearted, listener),
  );
};
