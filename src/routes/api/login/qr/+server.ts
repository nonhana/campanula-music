import { endpoints } from '#lib/api/endpoints.ts';
import { deviceIdFor } from '#lib/server/credentials.ts';
import { configFor } from '#lib/server/netease/config.ts';
import { createLoginQr } from '#lib/server/netease/login.ts';
import { withNetease } from '#lib/server/respond.ts';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = ({ cookies }) =>
  withNetease(endpoints.loginQr, () =>
    createLoginQr(configFor(deviceIdFor(cookies), null)),
  );
