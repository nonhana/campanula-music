import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { ncmLyric } from '$lib/server/ncm/lyric'
import { json } from '@sveltejs/kit'

/** 歌词接口实时调用门面，不走预渲染 */
export const prerender = false

export async function GET({ url }: RequestEvent) {
  const rawId = url.searchParams.get('id') ?? ''
  // 歌曲 id 只接受纯数字（网易云歌曲 id 为 u64），避免把脏输入透传给门面
  if (!/^\d+$/.test(rawId)) {
    return json({ error: { code: 'INVALID_PARAMS', message: '缺少有效的 id 参数' } }, { status: 400 })
  }

  try {
    // 歌词无需登录即可获取，无版权/未收录由门面如实标注；已绑定时携带凭据
    const bound = await resolveBoundUser()
    const lyrics = await ncmLyric({ cookie: bound?.cookie ?? '' }, Number(rawId))
    return json(lyrics)
  }
  catch (err) {
    return ncmErrorJson(err, '获取歌词失败')
  }
}
