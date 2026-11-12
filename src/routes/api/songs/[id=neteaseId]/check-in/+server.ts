import { endpoints } from '#lib/api/endpoints.js';
import { checkIn } from '#lib/server/netease/player.js';
import { readCheckIn } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const { source, seconds } = await readCheckIn(request);
  return respondSignedIn(endpoints.checkIn, cookies, (config) =>
    checkIn(id, source, seconds, config),
  );
};
