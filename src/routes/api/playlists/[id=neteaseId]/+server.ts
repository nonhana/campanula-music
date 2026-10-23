import type { RequestHandler } from './$types'
import { endpoints } from '#lib/api/endpoints.js'
import { fetchPlaylistPage } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

// 不在曲库里的一张歌单：头部和全部曲目编号；歌曲信息另外按页取（songs 端点）
export const GET: RequestHandler = ({ params, cookies }) => {
  const { id } = params
  return respondSignedIn(endpoints.playlist, cookies, listener => fetchPlaylistPage(id, listener))
}
