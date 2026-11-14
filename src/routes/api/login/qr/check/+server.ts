import { endpoints } from '#lib/api/endpoints.ts';
import type { QrCheckRequest } from '#lib/api/login.ts';
import { deviceIdFor, saveLogin } from '#lib/server/credentials.ts';
import { configFor } from '#lib/server/netease/config.ts';
import { checkLoginQr, fetchAccount } from '#lib/server/netease/login.ts';
import { QR_KEY, readFields } from '#lib/server/request.ts';
import { withNetease } from '#lib/server/respond.ts';

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
