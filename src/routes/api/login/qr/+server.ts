import { endpoints } from '#lib/api/endpoints.js';
import { deviceIdFor } from '#lib/server/credentials.js';
import { createLoginQr } from '#lib/server/netease.js';
import { withNetease } from '#lib/server/respond.js';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies }) =>
  withNetease(endpoints.loginQr, () =>
    createLoginQr({
      deviceId: deviceIdFor(cookies),
      credentials: null,
    }),
  );
