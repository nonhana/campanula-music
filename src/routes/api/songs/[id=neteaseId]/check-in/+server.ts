import type { RequestHandler } from './$types'
import { endpoints } from '#lib/api/endpoints.js'
import { checkIn } from '#lib/server/netease.js'
import { readCheckIn } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 听歌打卡：这首歌听完了（播完或切走），按实际听的整数秒、带上它自己的播放来源报给网易云
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const { id } = params
  const { source, seconds } = await readCheckIn(request)
  return respondSignedIn(endpoints.checkIn, cookies, listener => checkIn(id, source, seconds, listener))
}
