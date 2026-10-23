import type { RequestHandler } from './$types'
import { endpoints } from '#lib/api/endpoints.js'
import { fetchDaily } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

// 每日推荐：网易云今天给这个账号的那一份
export const GET: RequestHandler = ({ cookies }) => respondSignedIn(endpoints.daily, cookies, listener => fetchDaily(listener))
