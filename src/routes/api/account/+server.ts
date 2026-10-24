import { endpoints } from '#lib/api/endpoints.js'
import { readLogin } from '#lib/server/credentials.js'
import { fetchAccount } from '#lib/server/netease.js'
import { json, withNetease } from '#lib/server/respond.js'
import { asSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 当前账号，App 打开时问一次。没有登录 Cookie（或解不开、还没登录）时直接回“没有”、不调网易云；有凭据时问网易云：
// 离上次续期满 24 小时就先续期，凭据已经失效就续期一次再问，还是不行就回“需要登录”
export const GET: RequestHandler = ({ cookies }) => {
  const login = readLogin(cookies)
  if (!login?.session)
    return json(endpoints.account, { account: null })
  const signedIn = { ...login, session: login.session }
  return withNetease(endpoints.account, async () => ({ account: await asSignedIn(cookies, signedIn, fetchAccount, { renewIfDue: true }) }))
}
