import type { PlaylistsResponse } from '$lib/api/library'
import type { RequestHandler } from './$types'
import { fetchPlaylists } from '$lib/server/netease'
import { readId } from '$lib/server/request'
import { respondSignedIn } from '$lib/server/session'

// 歌单列表：我喜欢的音乐、自建的、收藏的
export const GET: RequestHandler = ({ url, cookies }) => {
  const uid = readId('uid', url.searchParams.get('uid'))
  return respondSignedIn(cookies, async listener => ({ playlists: await fetchPlaylists(uid, listener) } satisfies PlaylistsResponse))
}
