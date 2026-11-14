import { endpoints } from '#lib/api/endpoints.ts';
import type { SmsLoginRequest } from '#lib/api/login.ts';
import { CAPTCHA, PHONE } from '#lib/api/login.ts';
import { deviceIdFor, saveLogin } from '#lib/server/credentials.ts';
import { configFor } from '#lib/server/netease/config.ts';
import { loginWithCaptcha } from '#lib/server/netease/login.ts';
import { readFields } from '#lib/server/request.ts';
import { withNetease } from '#lib/server/respond.ts';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { phone, captcha } = await readFields<keyof SmsLoginRequest>(request, {
    phone: PHONE,
    captcha: CAPTCHA,
  });
  return withNetease(endpoints.loginSms, async () => {
    const deviceId = deviceIdFor(cookies);
    const { credentials, account } = await loginWithCaptcha(
      phone,
      captcha,
      configFor(deviceId),
    );
    saveLogin(cookies, deviceId, credentials);
    return { account };
  });
};
