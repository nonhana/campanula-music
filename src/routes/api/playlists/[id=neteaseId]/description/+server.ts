import type { RequestHandler } from './$types'
import { endpoints } from '#lib/api/endpoints.js'
import { describePlaylist } from '#lib/server/netease.js'
import { readPlaylistDescription } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 改自建歌单的简介；空的是清空。歌单已经被删掉时网易云照样回 200，客户端要等下一次同步才发现
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params
  const { description } = await readPlaylistDescription(request)
  return respondSignedIn(endpoints.describePlaylist, cookies, listener => describePlaylist(id, description, listener))
}
