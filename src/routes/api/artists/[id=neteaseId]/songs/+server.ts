import { endpoints } from '#lib/api/endpoints.js'
import { fetchArtistSongs } from '#lib/server/netease.js'
import { readArtistSongOrder, readOffset } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 歌手的一页歌曲：一种排法里从第 offset 首起
export const GET: RequestHandler = ({ params, url, cookies }) => {
  const { id } = params
  const order = readArtistSongOrder(url.searchParams.get('order'))
  const offset = readOffset(url.searchParams.get('offset'))
  return respondSignedIn(endpoints.artistSongs, cookies, listener => fetchArtistSongs(id, order, offset, listener))
}
