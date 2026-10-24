import { endpoints } from '#lib/api/endpoints.js'
import { coverUploadToken } from '#lib/server/netease.js'
import { respondSignedIn } from '#lib/server/session.js'

import type { RequestHandler } from './$types'

// 换封面的第一步（#34）：申请上传凭证。凭证和直传地址只交给浏览器，图片本身不经过 Campanula 的服务器
export const POST: RequestHandler = ({ cookies }) =>
  respondSignedIn(endpoints.coverToken, cookies, async listener => coverUploadToken(listener))
