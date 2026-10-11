import type { SmsLoginRequest, SmsLoginResponse } from '$lib/api/login'
import type { RequestHandler } from './$types'
import { deviceIdFor, saveLogin } from '$lib/server/credentials'
import { loginWithCaptcha } from '$lib/server/netease'
import { CAPTCHA, PHONE, readFields } from '$lib/server/request'
import { withNetease } from '$lib/server/respond'
import { json } from '@sveltejs/kit'

// 短信验证码登录：成功就把凭据和 deviceId 加密进登录 Cookie。
// 网易云可能因为风控拒绝（10004），说明原样交给界面，听众可以改用扫码
export const POST: RequestHandler = async ({ request, cookies }) => {
  const { phone, captcha } = await readFields<keyof SmsLoginRequest>(request, { phone: PHONE, captcha: CAPTCHA })
  return withNetease(async () => {
    const deviceId = deviceIdFor(cookies)
    const { credentials, account } = await loginWithCaptcha(phone, captcha, { deviceId, credentials: null })
    saveLogin(cookies, deviceId, credentials)
    return json({ account } satisfies SmsLoginResponse)
  })
}
