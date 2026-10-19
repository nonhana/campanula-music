import type { AddTracksResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { TRACKS_PER_CHANGE } from '#lib/api/library.js'
import { addTracks } from '#lib/server/netease.js'
import { readId, readIds } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 加入自建歌单（批量多选、添加歌曲选择器也是一次带上全部编号）：歌单已经被删掉时说 missing，客户端改回原样、马上同步一次
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const id = readId('id', params.id)
  const songIds = await readIds(request, 'songIds', TRACKS_PER_CHANGE)
  return respondSignedIn(cookies, listener => addTracks(id, songIds, listener) satisfies Promise<AddTracksResponse>)
}
