import type { TrackIdsResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { fetchTrackIds } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

// 一张歌单的全部曲目编号；歌曲信息另外按页取（/api/songs）
export const GET: RequestHandler = ({ params, cookies }) => {
  const { id } = params
  return respondSignedIn(cookies, async listener => ({ trackIds: await fetchTrackIds(id, listener) } satisfies TrackIdsResponse))
}
