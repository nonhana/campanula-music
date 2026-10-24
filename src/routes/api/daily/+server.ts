import { endpoints } from '#lib/api/endpoints.js'
import { fetchDaily } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

export const GET: RequestHandler = ({ cookies }) => respondSignedIn(endpoints.daily, cookies, listener => fetchDaily(listener))
