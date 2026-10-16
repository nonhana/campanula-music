import type { AlbumResponse } from '#lib/api/library.js'
import type { RequestHandler } from './$types'
import { fetchAlbum } from '#lib/server/netease.js'
import { readId } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 专辑页：曲目和简介
export const GET: RequestHandler = ({ params, cookies }) => {
  const id = readId('id', params.id)
  return respondSignedIn(cookies, listener => fetchAlbum(id, listener) satisfies Promise<AlbumResponse>)
}
