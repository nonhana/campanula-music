import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { ncmLyric } from '$lib/server/ncm/lyric'
import { json } from '@sveltejs/kit'

/** 歌词接口实时调用门面，不走预渲染 */
export const prerender = false

export async function GET({ url }: RequestEvent) {
  const rawId = url.searchParams.get('id') ?? ''
  // 歌曲 id 只接受正整数（网易云歌曲 id 为 u64），避免把脏输入透传给门面
  if (!/^\d+$/.test(rawId)) {
    return ncmErrorJson(new NcmError('INVALID_PARAMS', '缺少有效的 id 参数'), '请求参数不合法')
  }
  // u64 超出 Number 安全范围会被静默截断成错误 id，必须显式拒绝
  const id = Number(rawId)
  if (!Number.isSafeInteger(id) || id <= 0) {
    return ncmErrorJson(new NcmError('INVALID_PARAMS', 'id 超出有效范围'), '请求参数不合法')
  }

  try {
    // 歌词无需登录即可获取，无版权/未收录由门面如实标注；已绑定时携带凭据
    const bound = await resolveBoundUser()
    const lyrics = await ncmLyric({ cookie: bound?.cookie ?? '' }, id)
    return json(lyrics)
  }
  catch (err) {
    return ncmErrorJson(err, '获取歌词失败')
  }
}
