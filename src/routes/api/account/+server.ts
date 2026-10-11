import type { AccountResponse } from '$lib/api/account'
import type { RequestHandler } from './$types'
import { readLogin } from '$lib/server/credentials'
import { fetchAccount } from '$lib/server/netease'
import { withNetease } from '$lib/server/respond'
import { json } from '@sveltejs/kit'

// 当前账号。没有登录 Cookie（或解不开、还没登录）时直接回“没有”，不调网易云；
// 有凭据时问网易云，凭据已经失效就回“需要登录”
export const GET: RequestHandler = ({ cookies }) => {
  const login = readLogin(cookies)
  if (!login?.session)
    return json({ account: null } satisfies AccountResponse)
  const listener = { deviceId: login.deviceId, credentials: login.session.credentials }
  return withNetease(async () => json({ account: await fetchAccount(listener) } satisfies AccountResponse))
}
