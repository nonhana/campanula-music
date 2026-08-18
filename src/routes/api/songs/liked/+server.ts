import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { ncmLikedSongs } from '$lib/server/ncm/like'
import { json } from '@sveltejs/kit'

/** 我喜欢的音乐接口实时调用门面，不走预渲染；未绑定账号时引导绑定 */
export const prerender = false

/** 未绑定引导文案：与「绑定失效」共用 UNAUTHENTICATED 码，页面据此呈现引导 */
const UNBOUND_MESSAGE = '查看我喜欢的音乐需要账号许可：请先绑定网易云账号'

export async function GET(_event: RequestEvent) {
  const bound = await resolveBoundUser()
  if (!bound) {
    return json({ error: { code: 'UNAUTHENTICATED', message: UNBOUND_MESSAGE } }, { status: 401 })
  }

  try {
    const songs = await ncmLikedSongs({ cookie: bound.cookie }, bound.uid)
    return json(songs)
  }
  catch (err) {
    return ncmErrorJson(err, '获取我喜欢的音乐失败')
  }
}
