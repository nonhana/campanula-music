import { endpoints } from '#lib/api/endpoints.js'
import { fetchArtistAlbums } from '#lib/server/netease.js'
import { readOffset } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 歌手页后面的专辑：从第 offset 张起的一页
export const GET: RequestHandler = ({ params, url, cookies }) => {
  const { id } = params
  const offset = readOffset(url.searchParams.get('offset'))
  return respondSignedIn(endpoints.artistAlbums, cookies, listener => fetchArtistAlbums(id, offset, listener))
}
