import { endpoints } from '#lib/api/endpoints.js';
import { coverUploadToken } from '#lib/server/netease/playlist.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = ({ cookies, request }) =>
  respondSignedIn(endpoints.coverToken, { cookies, request }, async (config) =>
    coverUploadToken(config),
  );
