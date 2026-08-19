import type { NcmSearchType } from '$lib/types'
import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { ncmErrorJson } from '$lib/server/ncm/http'
import { ncmSearch } from '$lib/server/ncm/search'
import { json } from '@sveltejs/kit'

/** 搜索接口实时调用门面，不走预渲染 */
export const prerender = false

/** 合法搜索类型（对应网易云门面 NcmSearchType） */
const SEARCH_TYPES: readonly NcmSearchType[] = ['song', 'playlist', 'artist']

/** 默认分页大小 */
const DEFAULT_LIMIT = 30

export async function GET({ url }: RequestEvent) {
  const keywords = (url.searchParams.get('keywords') ?? '').trim()
  const rawType = url.searchParams.get('type')
  if (!keywords || !rawType || !SEARCH_TYPES.includes(rawType as NcmSearchType)) {
    return json({ error: { code: 'INVALID_PARAMS', message: '缺少有效的 keywords 或 type 参数' } }, { status: 400 })
  }

  const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.floor(rawLimit) : DEFAULT_LIMIT

  try {
    // 搜索无需登录；已绑定时携带凭据，让上游按账号许可返回更完整结果
    const bound = await resolveBoundUser()
    const page = await ncmSearch({ cookie: bound?.cookie ?? '' }, { keywords, type: rawType as NcmSearchType, limit })
    return json(page)
  }
  catch (err) {
    return ncmErrorJson(err, '搜索失败')
  }
}
