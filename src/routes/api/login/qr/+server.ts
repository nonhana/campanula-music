import { endpoints } from '#lib/api/endpoints.js';
import { deviceIdFor } from '#lib/server/credentials.js';
import { configFor } from '#lib/server/netease/config.js';
import { createLoginQr } from '#lib/server/netease/login.js';
import { withNetease } from '#lib/server/respond.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = ({ cookies }) =>
  withNetease(endpoints.loginQr, () =>
    createLoginQr(configFor(deviceIdFor(cookies), null)),
  );
