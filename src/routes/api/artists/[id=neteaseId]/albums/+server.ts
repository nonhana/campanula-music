import type { ArtistAlbumsResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { fetchArtistAlbums } from '#lib/server/netease.js'
import { readOffset } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 歌手页后面的专辑：从第 offset 张起的一页
export const GET: RequestHandler = ({ params, url, cookies }) => {
  const { id } = params
  const offset = readOffset(url.searchParams.get('offset'))
  return respondSignedIn(cookies, listener => fetchArtistAlbums(id, offset, listener) satisfies Promise<ArtistAlbumsResponse>)
}
