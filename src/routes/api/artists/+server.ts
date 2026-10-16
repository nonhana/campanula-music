import type { CollectedArtistsResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { fetchCollectedArtists } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

// 收藏的歌手：曲库同步的一步
export const GET: RequestHandler = ({ cookies }) =>
  respondSignedIn(cookies, async listener => ({ artists: await fetchCollectedArtists(listener) } satisfies CollectedArtistsResponse))
