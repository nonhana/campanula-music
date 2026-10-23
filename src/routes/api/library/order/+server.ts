import type { RequestHandler } from './$types'
import { endpoints } from '#lib/api/endpoints.js'
import { PLAYLISTS_PER_ORDER } from '#lib/api/library.js'
import { updatePlaylistOrder } from '#lib/server/netease.js'
import { readIds } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 曲库里能排序的歌单的新顺序（#37）：一次带上我喜欢的音乐和全部自建歌单的编号，我喜欢的音乐在最前。
// 已经删掉的歌单网易云会忽略、照样回 200；别的失败原样交给客户端翻译
export const POST: RequestHandler = async ({ request, cookies }) => {
  const playlistIds = await readIds(endpoints.playlistOrder, request, 'playlistIds', PLAYLISTS_PER_ORDER)
  return respondSignedIn(endpoints.playlistOrder, cookies, listener => updatePlaylistOrder(playlistIds, listener))
}
