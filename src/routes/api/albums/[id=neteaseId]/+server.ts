import type { RequestHandler } from './$types'
import { endpoints } from '#lib/api/endpoints.js'
import { fetchAlbum } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

// 专辑页：曲目和简介
export const GET: RequestHandler = ({ params, cookies }) => {
  const { id } = params
  return respondSignedIn(endpoints.album, cookies, listener => fetchAlbum(id, listener))
}
