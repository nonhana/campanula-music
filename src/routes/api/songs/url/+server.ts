import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { TRACK_CHUNK_SIZE } from '$lib/server/ncm/raw'
import { ncmSongUrl } from '$lib/server/ncm/songUrl'
import { DEFAULT_SOUND_LEVEL, isSoundLevel } from '$lib/soundLevel'
import { json } from '@sveltejs/kit'

/** 播放地址接口实时调用门面，不走预渲染 */
export const prerender = false

export async function GET({ url }: RequestEvent) {
  const rawIds = url.searchParams.get('ids') ?? ''
  // 歌曲 id 只接受逗号分隔的纯数字（网易云歌曲 id 为 u64），避免把脏输入透传给门面
  if (!/^\d+(?:,\d+)*$/.test(rawIds)) {
    return ncmErrorJson(new NcmError('INVALID_PARAMS', '缺少有效的 ids 参数'), '请求参数不合法')
  }
  const ids = rawIds.split(',').map(Number)
  // u64 超出 Number 安全范围会被静默截断成错误 id，必须显式拒绝
  if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    return ncmErrorJson(new NcmError('INVALID_PARAMS', 'ids 超出有效范围'), '请求参数不合法')
  }
  // 单请求 id 数有上限（与门面分片一致），防无界并发上游分片请求
  if (ids.length > TRACK_CHUNK_SIZE) {
    return ncmErrorJson(new NcmError('INVALID_PARAMS', `ids 数量超出上限（${TRACK_CHUNK_SIZE}）`), '请求参数不合法')
  }

  const rawLevel = url.searchParams.get('level') ?? DEFAULT_SOUND_LEVEL
  if (!isSoundLevel(rawLevel)) {
    return ncmErrorJson(new NcmError('INVALID_PARAMS', '缺少有效的 level 参数'), '请求参数不合法')
  }

  try {
    // 播放地址受账号许可影响（无许可回落试听片段）：已绑定时携带凭据获取完整播放
    const bound = await resolveBoundUser()
    const sources = await ncmSongUrl(
      { cookie: bound?.cookie ?? '' },
      { ids, level: rawLevel },
    )
    return json(sources)
  }
  catch (err) {
    return ncmErrorJson(err, '获取播放地址失败')
  }
}
