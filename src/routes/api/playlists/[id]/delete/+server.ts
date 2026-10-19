import type { PlaylistChangeResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { deletePlaylist } from '#lib/server/netease.js'
import { readId } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 删除自建歌单。歌单已经被删掉时网易云照样回 200
export const POST: RequestHandler = ({ params, cookies }) => {
  const id = readId('id', params.id)
  return respondSignedIn(cookies, async (listener) => {
    await deletePlaylist(id, listener)
    return { done: true } satisfies PlaylistChangeResponse
  })
}
