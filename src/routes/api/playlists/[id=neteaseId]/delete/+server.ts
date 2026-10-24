import { endpoints } from '#lib/api/endpoints.js'
import { deletePlaylist } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 删除自建歌单。歌单已经被删掉时网易云照样回 200
export const POST: RequestHandler = ({ params, cookies }) => {
  const { id } = params
  return respondSignedIn(endpoints.deletePlaylist, cookies, listener => deletePlaylist(id, listener))
}
