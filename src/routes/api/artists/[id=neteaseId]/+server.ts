import type { ArtistResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { fetchArtist } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

// 歌手页：头部、热门歌曲和第一页专辑；后面的专辑另外按页取（/api/artists/[id]/albums）
export const GET: RequestHandler = ({ params, cookies }) => {
  const { id } = params
  return respondSignedIn(cookies, listener => fetchArtist(id, listener) satisfies Promise<ArtistResponse>)
}
