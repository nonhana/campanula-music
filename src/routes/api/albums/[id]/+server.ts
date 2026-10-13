import type { AlbumResponse } from '$lib/api/library'
import type { RequestHandler } from './$types'
import { fetchAlbum } from '$lib/server/netease'
import { readId } from '$lib/server/request'
import { respondSignedIn } from '$lib/server/session'

// 专辑页：曲目和简介
export const GET: RequestHandler = ({ params, cookies }) => {
  const id = readId('id', params.id)
  return respondSignedIn(cookies, listener => fetchAlbum(id, listener) satisfies Promise<AlbumResponse>)
}
