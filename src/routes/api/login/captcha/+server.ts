import type { CaptchaRequest, CaptchaResponse } from '#lib/api/login.js'
import type { RequestHandler } from './$types'
import { deviceIdFor } from '#lib/server/credentials.js'
import { sendCaptcha } from '#lib/server/netease.js'
import { PHONE, readFields } from '#lib/server/request.js'
import { withNetease } from '#lib/server/respond.js'

// 发短信验证码。要先向网易云匿名注册，会间歇性失败，失败时界面说明原因、能重试
export const POST: RequestHandler = async ({ request, cookies }) => {
  const { phone } = await readFields<keyof CaptchaRequest>(request, { phone: PHONE })
  return withNetease(async () => {
    await sendCaptcha(phone, { deviceId: deviceIdFor(cookies), credentials: null })
    return Response.json({ sent: true } satisfies CaptchaResponse)
  })
}
