import type { ArtistAlbumsResponse } from '$lib/api/library'
import type { RequestHandler } from './$types'
import { fetchArtistAlbums } from '$lib/server/netease'
import { readId, readOffset } from '$lib/server/request'
import { respondSignedIn } from '$lib/server/session'

// 歌手页后面的专辑：从第 offset 张起的一页
export const GET: RequestHandler = ({ params, url, cookies }) => {
  const id = readId('id', params.id)
  const offset = readOffset(url.searchParams.get('offset'))
  return respondSignedIn(cookies, listener => fetchArtistAlbums(id, offset, listener) satisfies Promise<ArtistAlbumsResponse>)
}
