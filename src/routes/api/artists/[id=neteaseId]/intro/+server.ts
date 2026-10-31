import { endpoints } from '#lib/api/endpoints.js'
import { fetchArtistIntro } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 歌手的简介：一段简介和分段介绍，听众第一次切到简介标签时才取
export const GET: RequestHandler = ({ params, cookies }) => {
  const { id } = params
  return respondSignedIn(endpoints.artistIntro, cookies, listener => fetchArtistIntro(id, listener))
}
