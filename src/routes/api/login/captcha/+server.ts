import { endpoints } from '#lib/api/endpoints.ts';
import type { CaptchaRequest } from '#lib/api/login.ts';
import { PHONE } from '#lib/api/login.ts';
import { deviceIdFor } from '#lib/server/credentials.ts';
import { configFor } from '#lib/server/netease/config.ts';
import { sendCaptcha } from '#lib/server/netease/login.ts';
import { readFields } from '#lib/server/request.ts';
import { withNetease } from '#lib/server/respond.ts';

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
