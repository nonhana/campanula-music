import type { QrCheckRequest, QrCheckResponse } from '$lib/api/login'
import type { RequestHandler } from './$types'
import { deviceIdFor, saveLogin } from '$lib/server/credentials'
import { checkLoginQr, fetchAccount } from '$lib/server/netease'
import { QR_KEY, readFields } from '$lib/server/request'
import { withNetease } from '$lib/server/respond'
import { json } from '@sveltejs/kit'

// 查询扫码状态。听众在手机上确认后，先用新凭据问到账号，再把凭据和 deviceId 加密进登录 Cookie：
// 问不到账号就不存，免得留下一个界面不知道的登录
export const POST: RequestHandler = async ({ request, cookies }) => {
  const { key } = await readFields<keyof QrCheckRequest>(request, { key: QR_KEY })
  return withNetease(async () => {
    const deviceId = deviceIdFor(cookies)
    const check = await checkLoginQr(key, { deviceId, credentials: null })
    if (check.status !== 'confirmed')
      return json(check satisfies QrCheckResponse)
    const account = await fetchAccount({ deviceId, credentials: check.credentials })
    saveLogin(cookies, deviceId, check.credentials)
    return json({ status: 'signedIn', account } satisfies QrCheckResponse)
  })
}
