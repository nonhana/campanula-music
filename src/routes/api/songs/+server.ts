import type { SongsRequest, SongsResponse } from '$lib/api/library'
import type { RequestHandler } from './$types'
import { SONGS_PER_REQUEST } from '$lib/api/library'
import { fetchSongs } from '$lib/server/netease'
import { readIds } from '$lib/server/request'
import { respondSignedIn } from '$lib/server/session'

// 按编号取歌曲信息，一次最多 SONGS_PER_REQUEST 首（Vercel 单次响应不超过 4.5 MB）。
// 一千个编号放进网址太长，所以用 POST
export const POST: RequestHandler = async ({ request, cookies }) => {
  const ids = await readIds(request, 'ids' satisfies keyof SongsRequest, SONGS_PER_REQUEST)
  return respondSignedIn(cookies, async listener => ({ songs: await fetchSongs(ids, listener) } satisfies SongsResponse))
}
