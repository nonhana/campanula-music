import type { RequestHandler } from './$types'
import { endpoints } from '#lib/api/endpoints.js'
import { SONGS_PER_ORDER } from '#lib/api/library.js'
import { updateSongOrder } from '#lib/server/netease.js'
import { readIds } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 整张歌单的新顺序（多选里的拖动排序，#36）：一次带上全部曲目编号。
// 歌单已经被删掉时说 missing，客户端退回原来的顺序、马上同步一次；网易云回 -1 时说 unconfirmed，客户端重读确认
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params
  const songIds = await readIds(endpoints.songOrder, request, 'songIds', SONGS_PER_ORDER)
  return respondSignedIn(endpoints.songOrder, cookies, listener => updateSongOrder(id, songIds, listener))
}
