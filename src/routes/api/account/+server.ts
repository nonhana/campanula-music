import type { AccountResponse } from '$lib/api/account'
import type { RequestHandler } from './$types'
import { json } from '@sveltejs/kit'

// 当前账号。没有登录 Cookie 时直接回“没有”，不调网易云；登录（#19）之前不会有登录 Cookie
export const GET: RequestHandler = () => json({ account: null } satisfies AccountResponse)
