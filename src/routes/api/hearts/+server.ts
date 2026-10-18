import type { HeartResponse, HeartsResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { fetchHearts, heart } from '#lib/server/netease.js'
import { readHeart, readId } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 红心了哪些歌：曲库同步的第一步，凭据失效时它最先认出来（网易云回 301）
export const GET: RequestHandler = ({ url, cookies }) => {
  const uid = readId('uid', url.searchParams.get('uid'))
  return respondSignedIn(cookies, async listener => ({ songIds: await fetchHearts(uid, listener) } satisfies HeartsResponse))
}

// 红心或取消红心一首歌
export const POST: RequestHandler = async ({ request, cookies }) => {
  const { songId, hearted } = await readHeart(request)
  return respondSignedIn(cookies, async (listener) => {
    await heart(songId, hearted, listener)
    return { hearted } satisfies HeartResponse
  })
}
