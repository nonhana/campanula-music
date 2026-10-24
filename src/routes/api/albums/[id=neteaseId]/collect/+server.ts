import { endpoints } from '#lib/api/endpoints.js'
import { collectAlbum } from '#lib/server/netease.js'
import { readCollect } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params
  const { collected } = await readCollect(request)
  return respondSignedIn(endpoints.collectAlbum, cookies, listener => collectAlbum(id, collected, listener))
}
