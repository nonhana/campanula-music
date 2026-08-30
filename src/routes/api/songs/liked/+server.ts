import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { ncmLikedPage } from '$lib/server/ncm/like'
import { json } from '@sveltejs/kit'

/** 我喜欢的音乐接口实时调用门面，不走预渲染；未绑定账号时引导绑定 */
export const prerender = false

/** 未绑定引导文案：与「绑定失效」共用 UNAUTHENTICATED 码，页面据此呈现引导 */
const UNBOUND_MESSAGE = '查看我喜欢的音乐需要账号许可：请先绑定网易云账号'

export async function GET(event: RequestEvent) {
  const bound = await resolveBoundUser()
  if (!bound) {
    return json({ error: { code: 'UNAUTHENTICATED', message: UNBOUND_MESSAGE } }, { status: 401 })
  }

  // limit/offset 任一携带即分页（滚动加载）；都缺省返回全量（播放队列补全）
  const limitParam = event.url.searchParams.get('limit')
  const offsetParam = event.url.searchParams.get('offset')
  let request: { limit: number, offset: number } | undefined
  if (limitParam !== null || offsetParam !== null) {
    const limit = Number(limitParam)
    const offset = Number(offsetParam)
    if (!Number.isInteger(limit) || !Number.isInteger(offset) || limit < 0 || offset < 0) {
      return json(
        { error: { code: 'INVALID_PARAMS', message: '分页参数不合法' } },
        { status: 400 },
      )
    }
    request = { limit, offset }
  }

  try {
    const page = await ncmLikedPage({ cookie: bound.cookie }, bound.uid, request)
    return json(page)
  }
  catch (err) {
    return ncmErrorJson(err, '获取我喜欢的音乐失败')
  }
}
