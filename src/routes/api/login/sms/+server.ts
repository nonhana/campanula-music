import { endpoints } from '#lib/api/endpoints.js';
import type { SmsLoginRequest } from '#lib/api/login.js';
import { CAPTCHA, PHONE } from '#lib/api/login.js';
import { deviceIdFor, saveLogin } from '#lib/server/credentials.js';
import { configFor } from '#lib/server/netease/config.js';
import { loginWithCaptcha } from '#lib/server/netease/login.js';
import { readFields } from '#lib/server/request.js';
import { withNetease } from '#lib/server/respond.js';

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
