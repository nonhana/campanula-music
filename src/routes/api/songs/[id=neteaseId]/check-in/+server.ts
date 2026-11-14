import { endpoints } from '#lib/api/endpoints.ts';
import { checkIn } from '#lib/server/netease/player.ts';
import { readCheckIn } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params;
  const { source, seconds } = await readCheckIn(request);
  return respondSignedIn(endpoints.checkIn, { cookies, request }, (config) =>
    checkIn(id, source, seconds, config),
  );
};
