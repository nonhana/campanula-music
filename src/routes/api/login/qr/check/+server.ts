import { endpoints } from '#lib/api/endpoints.js'
import type { QrCheckRequest } from '#lib/api/login.js'
import { deviceIdFor, saveLogin } from '#lib/server/credentials.js'
import { checkLoginQr, fetchAccount } from '#lib/server/netease.js'
import { QR_KEY, readFields } from '#lib/server/request.js'
import { withNetease } from '#lib/server/respond.js'

import type { RequestHandler } from './$types'

// 查询扫码状态。确认后先用新凭据问到账号，再把凭据和 deviceId 加密进登录 Cookie；问不到账号就不存，免得留下一个界面不知道的登录
export const POST: RequestHandler = async ({ request, cookies }) => {
  const { key } = await readFields<keyof QrCheckRequest>(request, { key: QR_KEY })
  return withNetease(endpoints.checkLoginQr, async () => {
    const deviceId = deviceIdFor(cookies)
    const check = await checkLoginQr(key, { deviceId, credentials: null })
    if (check.status !== 'confirmed')
      return check
    const account = await fetchAccount({ deviceId, credentials: check.credentials })
    saveLogin(cookies, deviceId, check.credentials)
    return { status: 'signedIn' as const, account }
  })
}
