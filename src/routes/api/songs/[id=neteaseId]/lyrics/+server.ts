import { endpoints } from '#lib/api/endpoints.js'
import { fetchLyrics } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 一首歌的歌词，整理成一行一行的（逐字的每个词带起止）
export const GET: RequestHandler = ({ params, cookies }) => {
  const { id } = params
  return respondSignedIn(endpoints.lyrics, cookies, listener => fetchLyrics(id, listener))
}
