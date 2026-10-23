import type { PlaylistChangeResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { publishPlaylist } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

// 隐私歌单改公开（改不回去）。歌单已经被删掉时网易云照样回 200
export const POST: RequestHandler = ({ params, cookies }) => {
  const { id } = params
  return respondSignedIn(cookies, async (listener) => {
    await publishPlaylist(id, listener)
    return { done: true } satisfies PlaylistChangeResponse
  })
}
