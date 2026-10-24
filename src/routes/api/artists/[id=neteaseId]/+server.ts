import { endpoints } from '#lib/api/endpoints.js'
import { fetchArtist } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 歌手页：头部、热门歌曲和第一页专辑；后面的专辑另外按页取（artistAlbums 端点）
export const GET: RequestHandler = ({ params, cookies }) => {
  const { id } = params
  return respondSignedIn(endpoints.artist, cookies, listener => fetchArtist(id, listener))
}
