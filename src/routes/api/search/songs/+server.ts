import type { SearchSongsResponse } from '#lib/api/search.js'
import type { RequestHandler } from './$types'
import { searchSongs } from '#lib/server/netease.js'
import { readKeywords } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 单曲搜索：听众按了搜索
export const GET: RequestHandler = ({ url, cookies }) => {
  const keywords = readKeywords(url.searchParams.get('keywords'))
  return respondSignedIn(cookies, listener => searchSongs(keywords, listener) satisfies Promise<SearchSongsResponse>)
}
