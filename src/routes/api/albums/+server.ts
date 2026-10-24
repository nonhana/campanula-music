import { endpoints } from '#lib/api/endpoints.js'
import { fetchCollectedAlbums } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 收藏的专辑：曲库同步的一步
export const GET: RequestHandler = ({ cookies }) =>
  respondSignedIn(endpoints.albums, cookies, async listener => ({ albums: await fetchCollectedAlbums(listener) }))
