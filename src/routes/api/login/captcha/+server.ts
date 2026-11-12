import { endpoints } from '#lib/api/endpoints.js';
import type { CaptchaRequest } from '#lib/api/login.js';
import { PHONE } from '#lib/api/login.js';
import { deviceIdFor } from '#lib/server/credentials.js';
import { configFor } from '#lib/server/netease/config.js';
import { sendCaptcha } from '#lib/server/netease/login.js';
import { readFields } from '#lib/server/request.js';
import { withNetease } from '#lib/server/respond.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request, cookies }) => {
  const { phone } = await readFields<keyof CaptchaRequest>(request, {
    phone: PHONE,
  });
  return withNetease(endpoints.sendCaptcha, async () => {
    await sendCaptcha(phone, configFor(deviceIdFor(cookies), null));
    return { sent: true } as const;
  });
};
