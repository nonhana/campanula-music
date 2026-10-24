import { endpoints } from '#lib/api/endpoints.js'
import { fetchPlayUrl } from '#lib/server/netease.js'
import { readQuality } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 一首歌的播放地址：每次都向网易云要新的（约 20 分钟过期），浏览器拿它直连网易云的音频服务器
export const GET: RequestHandler = ({ params, url, cookies }) => {
  const { id } = params
  const quality = readQuality(url.searchParams.get('quality'))
  return respondSignedIn(endpoints.playUrl, cookies, listener => fetchPlayUrl(id, quality, listener))
}
