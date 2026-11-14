import { endpoints } from '#lib/api/endpoints.ts';
import { coverUploadToken } from '#lib/server/netease/playlist.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies, request }) =>
  respondSignedIn(endpoints.coverToken, { cookies, request }, async (config) =>
    coverUploadToken(config),
  );
