import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { ncmPlaylistDetail } from '$lib/server/ncm/playlists'
import { json } from '@sveltejs/kit'

/** 歌单详情接口实时调用门面，不走预渲染 */
export const prerender = false

export async function GET({ params }: RequestEvent) {
  const rawId = params.id ?? ''
  // 歌单 id 只接受正整数（网易云歌单 id 为 u64），避免把脏输入透传给门面
  if (!/^\d+$/.test(rawId)) {
    return ncmErrorJson(new NcmError('INVALID_PARAMS', '缺少有效的歌单 id'), '请求参数不合法')
  }
  // u64 超出 Number 安全范围会被静默截断成错误 id，必须显式拒绝
  const id = Number(rawId)
  if (!Number.isSafeInteger(id) || id <= 0) {
    return ncmErrorJson(new NcmError('INVALID_PARAMS', '歌单 id 超出有效范围'), '请求参数不合法')
  }

  try {
    // 歌单详情无需登录（未登录仅歌曲补全受限）；已绑定时携带凭据
    const bound = await resolveBoundUser()
    const detail = await ncmPlaylistDetail({ cookie: bound?.cookie ?? '' }, id)
    return json(detail)
  }
  catch (err) {
    return ncmErrorJson(err, '获取歌单详情失败')
  }
}
