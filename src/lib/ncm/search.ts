/**
 * 搜索页的客户端数据入口。
 *
 * 页面只经本模块访问 /api/search（服务端网易云门面的薄代理），
 * 测试注入假 provider 响应即由此处替换（vi.mock 本模块）。
 */
import type { NcmErrorCode, NcmSearchPage, NcmSearchType } from '$lib/types'
import { ncmFetchJson } from './client'

/** 搜索请求参数 */
export interface NcmSearchRequest {
  keywords: string
  type: NcmSearchType
  limit?: number
  /** 增量分页偏移（歌曲 tab 加载更多时传已收条数） */
  offset?: number
}

/** 搜索失败（服务端错误码 + 可展示消息）；与共享客户端错误同形 */
export { NcmClientError as SearchClientError } from './client'

const DEFAULT_LIMIT = 30

/** 错误码 → 页面文案（satisfies 保证新增错误码必须在编译期补齐文案） */
export const SEARCH_ERROR_TEXT = {
  UNAUTHENTICATED: '搜索需要账号许可，绑定已失效，请重新绑定',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  RESOURCE_UNAVAILABLE: '该资源暂不可用',
  UNKNOWN: '搜索失败，请稍后再试',
} satisfies Record<NcmErrorCode, string>

/** 实时搜索：请求服务端门面，返回领域结果页；失败抛 NcmClientError */
export async function searchNcm(request: NcmSearchRequest, signal?: AbortSignal): Promise<NcmSearchPage> {
  const params = new URLSearchParams({
    keywords: request.keywords,
    type: request.type,
    limit: String(request.limit ?? DEFAULT_LIMIT),
    offset: String(request.offset ?? 0),
  })
  return ncmFetchJson<NcmSearchPage>(`/api/search?${params}`, signal)
}
