import { endpoints } from '#lib/api/endpoints.js'
import { fetchTrackIds } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 一张歌单的全部曲目编号；歌曲信息另外按页取（songs 端点）
export const GET: RequestHandler = ({ params, cookies }) => {
  const { id } = params
  return respondSignedIn(endpoints.trackIds, cookies, async listener => ({ trackIds: await fetchTrackIds(id, listener) }))
}
