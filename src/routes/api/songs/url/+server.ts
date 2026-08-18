import type { NcmSoundLevel } from '$lib/types'
import type { RequestEvent } from '@sveltejs/kit'
import { DEFAULT_SOUND_LEVEL } from '$lib/ncm/songs'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { TRACK_CHUNK_SIZE } from '$lib/server/ncm/raw'
import { ncmSongUrl } from '$lib/server/ncm/songUrl'
import { json } from '@sveltejs/kit'

/** 播放地址接口实时调用门面，不走预渲染 */
export const prerender = false

/** 合法音质档位（对应网易云门面 NcmSoundLevel），缺省取客户端配置位 DEFAULT_SOUND_LEVEL */
const SOUND_LEVELS: readonly NcmSoundLevel[] = ['standard', 'higher', 'exhigh', 'lossless', 'hires']

export async function GET({ url }: RequestEvent) {
  const rawIds = url.searchParams.get('ids') ?? ''
  // 歌曲 id 只接受逗号分隔的纯数字（网易云歌曲 id 为 u64），避免把脏输入透传给门面
  if (!/^\d+(?:,\d+)*$/.test(rawIds)) {
    return json({ error: { code: 'INVALID_PARAMS', message: '缺少有效的 ids 参数' } }, { status: 400 })
  }
  const ids = rawIds.split(',').map(Number)
  // 单请求 id 数有上限（与门面分片一致），防无界并发上游分片请求
  if (ids.length > TRACK_CHUNK_SIZE) {
    return json({ error: { code: 'INVALID_PARAMS', message: `ids 数量超出上限（${TRACK_CHUNK_SIZE}）` } }, { status: 400 })
  }

  const rawLevel = url.searchParams.get('level') ?? DEFAULT_SOUND_LEVEL
  if (!SOUND_LEVELS.includes(rawLevel as NcmSoundLevel)) {
    return json({ error: { code: 'INVALID_PARAMS', message: '缺少有效的 level 参数' } }, { status: 400 })
  }

  try {
    // 播放地址受账号许可影响（无许可回落试听片段）；凭据由 Ticket 02 接入
    const sources = await ncmSongUrl(
      { cookie: '' },
      { ids, level: rawLevel as NcmSoundLevel },
    )
    return json(sources)
  }
  catch (err) {
    return ncmErrorJson(err, '获取播放地址失败')
  }
}
