import { endpoints } from '#lib/api/endpoints.js';
import type { QrCheckRequest } from '#lib/api/login.js';
import { deviceIdFor, saveLogin } from '#lib/server/credentials.js';
import { configFor } from '#lib/server/netease/config.js';
import { checkLoginQr, fetchAccount } from '#lib/server/netease/login.js';
import { QR_KEY, readFields } from '#lib/server/request.js';
import { withNetease } from '#lib/server/respond.js';

import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request, cookies }) => {
  const { key } = await readFields<keyof QrCheckRequest>(request, {
    key: QR_KEY,
  });
  return withNetease(endpoints.checkLoginQr, async () => {
    const deviceId = deviceIdFor(cookies);
    const check = await checkLoginQr(key, configFor(deviceId));
    if (check.status !== 'confirmed') return check;
    const account = await fetchAccount(configFor(deviceId, check.credentials));
    saveLogin(cookies, deviceId, check.credentials);
    return { status: 'signedIn' as const, account };
  });
};
