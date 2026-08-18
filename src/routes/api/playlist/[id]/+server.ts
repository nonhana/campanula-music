import type { RequestEvent } from '@sveltejs/kit'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { ncmPlaylistDetail } from '$lib/server/ncm/playlists'
import { json } from '@sveltejs/kit'

/** 歌单详情接口实时调用门面，不走预渲染 */
export const prerender = false

export async function GET({ params }: RequestEvent) {
  const rawId = params.id ?? ''
  // 歌单 id 只接受纯数字（网易云歌单 id 为 u64），避免把脏输入透传给门面
  if (!/^\d+$/.test(rawId)) {
    return json({ error: { code: 'INVALID_PARAMS', message: '缺少有效的歌单 id' } }, { status: 400 })
  }

  try {
    // 歌单详情无需登录（未登录仅歌曲补全受限），凭据由 Ticket 02 接入
    const detail = await ncmPlaylistDetail({ cookie: '' }, Number(rawId))
    return json(detail)
  }
  catch (err) {
    return ncmErrorJson(err, '获取歌单详情失败')
  }
}
