import type { RemoveTracksResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { TRACKS_PER_CHANGE } from '#lib/api/library.js'
import { removeTracks } from '#lib/server/netease.js'
import { readIds } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 从自建歌单移除歌（批量移除一次带上全部编号）：歌单已经被删掉时说 missing，客户端放回原位、马上同步一次
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params
  const songIds = await readIds(request, 'songIds', TRACKS_PER_CHANGE)
  return respondSignedIn(cookies, listener => removeTracks(id, songIds, listener) satisfies Promise<RemoveTracksResponse>)
}
