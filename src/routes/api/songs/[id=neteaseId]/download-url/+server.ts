import type { DownloadUrlResponse } from '#lib/api/playback.js'
import type { RequestHandler } from './$types'
import { fetchDownloadUrl } from '#lib/server/netease.js'
import { readQuality } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 下载一首用的地址：每次都向网易云要新的（约 20 分钟过期），浏览器拿到就直连网易云的音频服务器下（#38）
export const GET: RequestHandler = ({ params, url, cookies }) => {
  const { id } = params
  const quality = readQuality(url.searchParams.get('quality'))
  return respondSignedIn(cookies, listener => fetchDownloadUrl(id, quality, listener) satisfies Promise<DownloadUrlResponse>)
}
