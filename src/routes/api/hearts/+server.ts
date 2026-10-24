import { endpoints } from '#lib/api/endpoints.js'
import { fetchHearts, heart } from '#lib/server/netease.js'
import { readHeart, readId } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 红心了哪些歌：曲库同步的第一步，凭据失效时它最先认出来（网易云回 301）
export const GET: RequestHandler = ({ url, cookies }) => {
  const uid = readId('uid', url.searchParams.get('uid'))
  return respondSignedIn(endpoints.hearts, cookies, async listener => ({ songIds: await fetchHearts(uid, listener) }))
}

// 红心或取消红心一首歌
export const POST: RequestHandler = async ({ request, cookies }) => {
  const { songId, hearted } = await readHeart(request)
  return respondSignedIn(endpoints.heart, cookies, listener => heart(songId, hearted, listener))
}
