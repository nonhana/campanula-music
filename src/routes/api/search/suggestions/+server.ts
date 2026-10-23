import type { RequestHandler } from './$types'
import { endpoints } from '#lib/api/endpoints.js'
import { fetchSuggestions } from '#lib/server/netease.js'
import { readKeywords } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 边输入边给的建议：听众在搜索框里停手时问一次
export const GET: RequestHandler = ({ url, cookies }) => {
  const keywords = readKeywords(url.searchParams.get('keywords'))
  return respondSignedIn(endpoints.suggestions, cookies, listener => fetchSuggestions(keywords, listener))
}
