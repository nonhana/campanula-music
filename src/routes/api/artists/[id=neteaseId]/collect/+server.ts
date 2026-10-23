import type { CollectResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { collectArtist } from '#lib/server/netease.js'
import { readCollect } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 收藏或取消收藏歌手
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params
  const { collected } = await readCollect(request)
  return respondSignedIn(cookies, async (listener) => {
    await collectArtist(id, collected, listener)
    return { collected } satisfies CollectResponse
  })
}
