import { endpoints } from '#lib/api/endpoints.js'
import { collectPlaylist } from '#lib/server/netease.js'
import { readPlaylistCollect } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 收藏或取消收藏歌单：歌单已经被删掉时说 missing，客户端改回原样、马上同步一次。收藏时的反作弊令牌只透传给网易云，不记日志、不存
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params
  const change = await readPlaylistCollect(request)
  return respondSignedIn(endpoints.collectPlaylist, cookies, listener => collectPlaylist(id, change, listener))
}
