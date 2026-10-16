import type { PlayUrlResponse } from '#lib/api/playback.js'
import type { RequestHandler } from './$types'
import { fetchPlayUrl } from '#lib/server/netease.js'
import { readId, readQuality } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 一首歌的播放地址：每次都向网易云要新的（约 20 分钟过期），浏览器拿它直连网易云的音频服务器
export const GET: RequestHandler = ({ params, url, cookies }) => {
  const id = readId('id', params.id)
  const quality = readQuality(url.searchParams.get('quality'))
  return respondSignedIn(cookies, listener => fetchPlayUrl(id, quality, listener) satisfies Promise<PlayUrlResponse>)
}
