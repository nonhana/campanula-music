import { endpoints } from '#lib/api/endpoints.js'
import { SONGS_PER_REQUEST } from '#lib/api/library.js'
import { fetchSongs } from '#lib/server/netease.js'
import { readIds } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 按编号取歌曲信息，一次最多 SONGS_PER_REQUEST 首（Vercel 单次响应不超过 4.5 MB）；一千个编号放进网址太长，所以用 POST
export const POST: RequestHandler = async ({ request, cookies }) => {
  const ids = await readIds(endpoints.songs, request, 'ids', SONGS_PER_REQUEST)
  return respondSignedIn(endpoints.songs, cookies, async listener => ({ songs: await fetchSongs(ids, listener) }))
}
