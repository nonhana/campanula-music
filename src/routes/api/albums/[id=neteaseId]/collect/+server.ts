import { endpoints } from '#lib/api/endpoints.ts';
import { collectAlbum } from '#lib/server/netease/library.ts';
import { readCollect } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const { collected } = await readCollect(request);
  return respondSignedIn(
    endpoints.collectAlbum,
    { cookies, request },
    (config) => collectAlbum(id, collected, config),
  );
};
