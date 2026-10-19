import type { CreatePlaylistResponse, PlaylistsResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { createPlaylist, fetchPlaylists } from '#lib/server/netease.js'
import { readId, readPlaylistDraft } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 歌单列表：我喜欢的音乐、自建的、收藏的
export const GET: RequestHandler = ({ url, cookies }) => {
  const uid = readId('uid', url.searchParams.get('uid'))
  return respondSignedIn(cookies, async listener => ({ playlists: await fetchPlaylists(uid, listener) } satisfies PlaylistsResponse))
}

// 新建自建歌单：建好后读回它的详情，客户端拿到完整的歌单才放进曲库
export const POST: RequestHandler = async ({ request, cookies }) => {
  const draft = await readPlaylistDraft(request)
  return respondSignedIn(cookies, async listener => ({ playlist: await createPlaylist(draft.name, draft.private, listener) } satisfies CreatePlaylistResponse))
}
