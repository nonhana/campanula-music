import type { RequestHandler } from './$types'
import { endpoints } from '#lib/api/endpoints.js'
import { publishPlaylist } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

// 隐私歌单改公开（改不回去）。歌单已经被删掉时网易云照样回 200
export const POST: RequestHandler = ({ params, cookies }) => {
  const { id } = params
  return respondSignedIn(endpoints.publishPlaylist, cookies, listener => publishPlaylist(id, listener))
}
