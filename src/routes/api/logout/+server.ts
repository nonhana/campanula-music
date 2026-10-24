import { endpoints } from '#lib/api/endpoints.js'
import { clearLogin, readLogin } from '#lib/server/credentials.js'
import { logout, NeteaseError } from '#lib/server/netease.js'
import { json } from '#lib/server/respond.js'

import type { RequestHandler } from './$types'

// 退出登录：带着凭据调网易云的退出，然后回过期的登录 Cookie。
// 网易云那边没退成（断网、出错、本来就失效了）也照样删掉 Cookie：听众要的是这个浏览器不再登录；
// 凭据在网易云那边可能还有效，服务器不存凭据，没法替听众作废它（ADR-0003）。失败已经记在日志里
export const POST: RequestHandler = async ({ cookies }) => {
  const login = readLogin(cookies)
  if (login?.session) {
    try {
      await logout({ deviceId: login.deviceId, credentials: login.session.credentials })
    }
    catch (error) {
      if (!(error instanceof NeteaseError))
        throw error
    }
  }
  clearLogin(cookies)
  return json(endpoints.logout, { signedOut: true })
}
