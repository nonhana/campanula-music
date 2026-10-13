import type { CollectedAlbumsResponse } from '$lib/api/library'
import type { RequestHandler } from './$types'
import { fetchCollectedAlbums } from '$lib/server/netease'
import { respondSignedIn } from '$lib/server/session'

// 收藏的专辑：曲库同步的一步
export const GET: RequestHandler = ({ cookies }) =>
  respondSignedIn(cookies, async listener => ({ albums: await fetchCollectedAlbums(listener) } satisfies CollectedAlbumsResponse))
