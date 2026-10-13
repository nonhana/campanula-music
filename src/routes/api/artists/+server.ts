import type { CollectedArtistsResponse } from '$lib/api/library'
import type { RequestHandler } from './$types'
import { fetchCollectedArtists } from '$lib/server/netease'
import { respondSignedIn } from '$lib/server/session'

// 收藏的歌手：曲库同步的一步
export const GET: RequestHandler = ({ cookies }) =>
  respondSignedIn(cookies, async listener => ({ artists: await fetchCollectedArtists(listener) } satisfies CollectedArtistsResponse))
