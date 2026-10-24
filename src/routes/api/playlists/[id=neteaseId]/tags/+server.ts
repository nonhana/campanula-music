import { endpoints } from '#lib/api/endpoints.js'
import { tagPlaylist } from '#lib/server/netease.js'
import { readPlaylistTags } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 给自建歌单换一组标签（从标签库里选的）。歌单已经被删掉时网易云照样回 200，客户端要等下一次同步才发现
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params
  const { tags } = await readPlaylistTags(request)
  return respondSignedIn(endpoints.tagPlaylist, cookies, listener => tagPlaylist(id, tags, listener))
}
