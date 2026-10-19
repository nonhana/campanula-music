import type { SetCoverResponse } from '#lib/api/cover.js'
import type { RequestHandler } from './$types'
import { setPlaylistCover } from '#lib/server/netease.js'
import { readCoverImage, readId } from '#lib/server/request.js'
import { respondSignedIn } from '#lib/server/session.js'

// 换封面的第三步（#34）：把已经直传成功的图片设为封面。歌单已经被删掉时网易云照样回 200（验证关卡②）
export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const id = readId('id', params.id)
  const { imgId } = await readCoverImage(request)
  return respondSignedIn(cookies, async listener => await setPlaylistCover(id, imgId, listener) satisfies SetCoverResponse)
}
