import { endpoints } from '#lib/api/endpoints.js'
import { deviceIdFor } from '#lib/server/credentials.js'
import { createLoginQr } from '#lib/server/netease.js'
import { withNetease } from '#lib/server/respond.js'

import type { RequestHandler } from './$types'

// 一张新的登录二维码。要先向网易云匿名注册，会间歇性失败，失败时界面说明原因、能重试
export const POST: RequestHandler = ({ cookies }) => withNetease(endpoints.loginQr, () =>
  createLoginQr({
    deviceId: deviceIdFor(cookies),
    credentials: null,
  }))
