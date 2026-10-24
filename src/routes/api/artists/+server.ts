import { endpoints } from '#lib/api/endpoints.js'
import { fetchCollectedArtists } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 收藏的歌手：曲库同步的一步
export const GET: RequestHandler = ({ cookies }) =>
  respondSignedIn(endpoints.artists, cookies, async listener => ({ artists: await fetchCollectedArtists(listener) }))
