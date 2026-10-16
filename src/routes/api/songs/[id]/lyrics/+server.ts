import type { LyricsResponse } from '#lib/api/playback.js'
import type { RequestHandler } from './$types'
import { fetchLyrics } from '#lib/server/netease.js'
import { readId } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 一首歌的歌词，整理成一行一行的（逐字的每个词带起止）
export const GET: RequestHandler = ({ params, cookies }) => {
  const id = readId('id', params.id)
  return respondSignedIn(cookies, listener => fetchLyrics(id, listener) satisfies Promise<LyricsResponse>)
}
