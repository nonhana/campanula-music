import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { ncmLike } from '$lib/server/ncm/like'
import { json } from '@sveltejs/kit'

/** 红心写回接口实时调用门面，不走预渲染；未绑定账号时引导绑定 */
export const prerender = false

/** 未绑定引导文案：与「绑定失效」共用 UNAUTHENTICATED 码，页面据此呈现引导 */
const UNBOUND_MESSAGE = '红心需要账号许可：请先绑定网易云账号'

/** 请求体：歌曲 id（网易云歌曲 id 为 u64）+ 红心状态 */
interface LikeBody {
  id?: unknown
  like?: unknown
}

function parseLikeBody(body: unknown): { id: number, like: boolean } | null {
  if (typeof body !== 'object' || body === null)
    return null
  const { id, like } = body as LikeBody
  // 歌曲 id 只接受正整数，like 只接受布尔，避免把脏输入透传给门面
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)
    return null
  if (typeof like !== 'boolean')
    return null
  return { id, like }
}

export async function POST(event: RequestEvent) {
  const bound = await resolveBoundUser()
  if (!bound) {
    return json({ error: { code: 'UNAUTHENTICATED', message: UNBOUND_MESSAGE } }, { status: 401 })
  }

  let body: unknown
  try {
    body = await event.request.json()
  }
  catch {
    return ncmErrorJson(new NcmError('INVALID_PARAMS', '请求体不是有效的 JSON'), '请求参数不合法')
  }

  const params = parseLikeBody(body)
  if (!params) {
    return ncmErrorJson(new NcmError('INVALID_PARAMS', '缺少有效的 id 或 like 参数'), '请求参数不合法')
  }

  try {
    await ncmLike({ cookie: bound.cookie }, params)
    return json({ ok: true })
  }
  catch (err) {
    return ncmErrorJson(err, '红心操作失败')
  }
}
