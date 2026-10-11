import type { QrResponse } from '$lib/api/login'
import type { RequestHandler } from './$types'
import { deviceIdFor } from '$lib/server/credentials'
import { createLoginQr } from '$lib/server/netease'
import { withNetease } from '$lib/server/respond'
import { json } from '@sveltejs/kit'

// 一张新的登录二维码。要先向网易云匿名注册，会间歇性失败，失败时界面说明原因、能重试
export const POST: RequestHandler = ({ cookies }) => withNetease(async () =>
  json(await createLoginQr({ deviceId: deviceIdFor(cookies), credentials: null }) satisfies QrResponse))
