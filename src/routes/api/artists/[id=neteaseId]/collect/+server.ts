import type { RequestHandler } from './$types'
import { endpoints } from '#lib/api/endpoints.js'
import { collectArtist } from '#lib/server/netease.js'
import { readCollect } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 收藏或取消收藏歌手
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params
  const { collected } = await readCollect(request)
  return respondSignedIn(endpoints.collectArtist, cookies, listener => collectArtist(id, collected, listener))
}
