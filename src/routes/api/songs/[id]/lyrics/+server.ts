import type { LyricsResponse } from '$lib/api/playback'
import type { RequestHandler } from './$types'
import { fetchLyrics } from '$lib/server/netease'
import { readId } from '$lib/server/request'
import { respondSignedIn } from '$lib/server/session'

// 一首歌的歌词，整理成一行一行的（逐字的每个词带起止）
export const GET: RequestHandler = ({ params, cookies }) => {
  const id = readId('id', params.id)
  return respondSignedIn(cookies, listener => fetchLyrics(id, listener) satisfies Promise<LyricsResponse>)
}
