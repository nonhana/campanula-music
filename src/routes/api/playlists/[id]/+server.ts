import type { PlaylistPageResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { fetchPlaylistPage } from '#lib/server/netease.js'
import { readId } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 不在曲库里的一张歌单：头部和全部曲目编号；歌曲信息另外按页取（/api/songs）
export const GET: RequestHandler = ({ params, cookies }) => {
  const id = readId('id', params.id)
  return respondSignedIn(cookies, listener => fetchPlaylistPage(id, listener) satisfies Promise<PlaylistPageResponse>)
}
