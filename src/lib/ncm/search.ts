/**
 * 搜索页的客户端数据入口。
 *
 * 页面只经本模块访问 /api/search（服务端网易云门面的薄代理），
 * 测试注入假 provider 响应即由此处替换（vi.mock 本模块）。
 */
import type { NcmErrorCode, NcmSearchPage, NcmSearchSong, NcmSearchType, SongItem } from '$lib/types'

/** 搜索请求参数 */
export interface NcmSearchRequest {
  keywords: string
  type: NcmSearchType
  limit?: number
}

/** 服务端返回的搜索错误 JSON 形状 */
interface SearchErrorResponseBody {
  error?: { code?: string, message?: string }
}

/** 搜索失败（服务端错误码 + 可展示消息） */
export class SearchClientError extends Error {
  readonly code: NcmErrorCode

  constructor(code: NcmErrorCode, message: string) {
    super(message)
    this.name = 'SearchClientError'
    this.code = code
  }
}

const DEFAULT_LIMIT = 30

/** 错误码 → 页面文案（satisfies 保证新增错误码必须在编译期补齐文案） */
export const SEARCH_ERROR_TEXT = {
  UNAUTHENTICATED: '搜索需要账号许可，绑定已失效，请重新绑定',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  RESOURCE_UNAVAILABLE: '该资源暂不可用',
  UNKNOWN: '搜索失败，请稍后再试',
} satisfies Record<NcmErrorCode, string>

/** 实时搜索：请求服务端门面，返回领域结果页；失败抛 SearchClientError */
export async function searchNcm(request: NcmSearchRequest, signal?: AbortSignal): Promise<NcmSearchPage> {
  const params = new URLSearchParams({
    keywords: request.keywords,
    type: request.type,
    limit: String(request.limit ?? DEFAULT_LIMIT),
  })
  const res = await fetch(`/api/search?${params}`, { signal })
  if (!res.ok) {
    let code: NcmErrorCode = 'UNKNOWN'
    let message = `搜索失败（HTTP ${res.status}）`
    try {
      const body = await res.json() as SearchErrorResponseBody
      if (body.error?.code && isNcmErrorCode(body.error.code)) {
        code = body.error.code
        message = body.error.message ?? message
      }
    }
    catch {
      // 非 JSON 响应体按 UNKNOWN 处理
    }
    throw new SearchClientError(code, message)
  }
  return await res.json() as NcmSearchPage
}

/** 服务端错误码白名单；以文案表为准，新增码漏配文案会在编译期报错 */
function isNcmErrorCode(value: string): value is NcmErrorCode {
  return value in SEARCH_ERROR_TEXT
}

/** 把搜索歌曲条目映射为播放链路使用的 SongItem（sourceId 取网易云歌曲 id） */
export function toSongItem(song: NcmSearchSong): SongItem {
  return {
    id: song.id,
    name: song.name,
    cover: song.album.cover,
    alias: [],
    artists: song.artists,
    album: song.album,
    duration: song.duration,
    sourceId: String(song.id),
  }
}
