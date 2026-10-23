import type { SmsLoginRequest } from '#lib/api/login.js'
import type { RequestHandler } from './$types'
import { endpoints } from '#lib/api/endpoints.js'
import { CAPTCHA, PHONE } from '#lib/api/login.js'
import { deviceIdFor, saveLogin } from '#lib/server/credentials.js'
import { loginWithCaptcha } from '#lib/server/netease.js'
import { readFields } from '#lib/server/request.js'
import { withNetease } from '#lib/server/respond.js'

// 短信验证码登录：成功就把凭据和 deviceId 加密进登录 Cookie。
// 网易云可能因为风控拒绝（10004），说明原样交给界面，听众可以改用扫码
export const POST: RequestHandler = async ({ request, cookies }) => {
  const { phone, captcha } = await readFields<keyof SmsLoginRequest>(request, { phone: PHONE, captcha: CAPTCHA })
  return withNetease(endpoints.loginSms, async () => {
    const deviceId = deviceIdFor(cookies)
    const { credentials, account } = await loginWithCaptcha(phone, captcha, { deviceId, credentials: null })
    saveLogin(cookies, deviceId, credentials)
    return { account }
  })
}
