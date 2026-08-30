import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { ncmPlaylistTracks } from '$lib/server/ncm/playlists'
import { TRACK_CHUNK_SIZE } from '$lib/server/ncm/raw'
import { json } from '@sveltejs/kit'

/** 歌单曲目分页接口实时调用门面，不走预渲染 */
export const prerender = false

/** 默认每页数量 */
const DEFAULT_LIMIT = 100

/** 歌单 id 只接受纯数字（网易云歌单 id 为 u64）；limit 必须为正整数（"0" 会被 || 静默吞成默认值）；offset 为非负整数 */
function validate(rawId: string, rawLimit: string | null, rawOffset: string | null): string | null {
  if (!/^\d+$/.test(rawId))
    return '缺少有效的歌单 id'
  if (rawLimit !== null && (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1))
    return 'limit 必须是正整数'
  if (rawOffset !== null && !/^\d+$/.test(rawOffset))
    return 'offset 必须是非负整数'
  return null
}

export async function GET({ params, url }: RequestEvent) {
  const rawId = params.id ?? ''
  const rawLimit = url.searchParams.get('limit')
  const rawOffset = url.searchParams.get('offset')

  const invalidMessage = validate(rawId, rawLimit, rawOffset)
  if (invalidMessage) {
    return ncmErrorJson(new NcmError('INVALID_PARAMS', invalidMessage), '请求参数不合法')
  }

  try {
    // 歌单曲目无需登录（未登录仅部分受限歌曲缺失）；已绑定时携带凭据
    const bound = await resolveBoundUser()
    const songs = await ncmPlaylistTracks(
      { cookie: bound?.cookie ?? '' },
      Number(rawId),
      {
        // 单页上限与批量详情请求的分片上限对齐，防止单请求超限截断
        limit: Math.min(Number(rawLimit ?? DEFAULT_LIMIT), TRACK_CHUNK_SIZE),
        offset: Number(rawOffset ?? 0),
      },
    )
    return json({ songs })
  }
  catch (err) {
    return ncmErrorJson(err, '获取歌单歌曲失败')
  }
}
