import { searchPage } from '#lib/api/endpoints.js'
import { searches } from '#lib/server/netease.js'
import { readKeywords, readOffset, readSearchKind } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 一类搜索结果（单曲、歌单、歌手、专辑）从第 offset 个起的一页
export const GET: RequestHandler = ({ params, url, cookies }) => {
  const kind = readSearchKind(params.kind)
  const keywords = readKeywords(url.searchParams.get('keywords'))
  const offset = readOffset(url.searchParams.get('offset'))
  return respondSignedIn(searchPage(kind), cookies, listener => searches[kind](keywords, offset, listener))
}
