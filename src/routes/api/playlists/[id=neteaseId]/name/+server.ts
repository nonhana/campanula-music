import type { PlaylistChangeResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { renamePlaylist } from '#lib/server/netease.js'
import { readPlaylistRename } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 改自建歌单的名称。歌单已经被删掉时网易云照样回 200，客户端要等下一次同步才发现
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params
  const { name } = await readPlaylistRename(request)
  return respondSignedIn(cookies, async (listener) => {
    await renamePlaylist(id, name, listener)
    return { done: true } satisfies PlaylistChangeResponse
  })
}
