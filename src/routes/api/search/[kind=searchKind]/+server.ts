import type { SearchPageResponse } from '#lib/api/search.js'
import type { RequestHandler } from './$types'
import { searches } from '#lib/server/netease.js'
import { readKeywords, readOffset } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 一类搜索结果（单曲、歌单、歌手、专辑）从第 offset 个起的一页
export const GET: RequestHandler = ({ params, url, cookies }) => {
  const keywords = readKeywords(url.searchParams.get('keywords'))
  const offset = readOffset(url.searchParams.get('offset'))
  return respondSignedIn(cookies, listener => searches[params.kind](keywords, offset, listener) satisfies Promise<SearchPageResponse>)
}
