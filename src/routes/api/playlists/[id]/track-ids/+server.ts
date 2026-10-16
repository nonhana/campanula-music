import type { TrackIdsResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { fetchTrackIds } from '#lib/server/netease.js'
import { readId } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 一张歌单的全部曲目编号；歌曲信息另外按页取（/api/songs）
export const GET: RequestHandler = ({ params, cookies }) => {
  const id = readId('id', params.id)
  return respondSignedIn(cookies, async listener => ({ trackIds: await fetchTrackIds(id, listener) } satisfies TrackIdsResponse))
}
