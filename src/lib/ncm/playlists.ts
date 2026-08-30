/**
 * 歌单页面的客户端数据入口（我的歌单 / 歌单详情）。
 *
 * 页面只经本模块访问服务端网易云门面的薄代理，
 * 测试注入假 provider 响应即由此处替换（vi.mock 本模块）。
 */
import type { NcmErrorCode, NcmPlaylistDetail, NcmSong, NcmUserPlaylists } from '$lib/types'
import { ncmFetchJson } from './client'

/** 错误码 → 页面文案（satisfies 保证新增错误码必须在编译期补齐文案） */
export const PLAYLIST_ERROR_TEXT = {
  UNAUTHENTICATED: '查看歌单需要账号许可：请先绑定网易云账号',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  RESOURCE_UNAVAILABLE: '该资源暂不可用',
  INVALID_PARAMS: '请求参数不合法，请检查后重试',
  UNKNOWN: '获取歌单失败，请稍后再试',
} satisfies Record<NcmErrorCode, string>

/** 浏览用分页大小：歌单详情首屏与触底增量的每页曲目数 */
export const PLAYLIST_PAGE_SIZE = 100

/** 队列补全分页大小：与单请求 id 分片上限一致，整张歌单补全按 1000 首并行拉取 */
export const PLAYLIST_QUEUE_CHUNK = 1000

/** 拉取我的歌单：创建的歌单与收藏的歌单两组 */
export function fetchUserPlaylists(signal?: AbortSignal): Promise<NcmUserPlaylists> {
  return ncmFetchJson<NcmUserPlaylists>('/api/playlists', signal)
}

/** 按 id 拉取歌单详情头信息（歌曲经 fetchPlaylistTracks 分页拉取）；fetcher 供服务端 load 注入 event.fetch */
export function fetchPlaylistDetail(id: number, fetcher: typeof fetch = fetch): Promise<NcmPlaylistDetail> {
  return ncmFetchJson<NcmPlaylistDetail>(`/api/playlist/${id}`, undefined, fetcher)
}

/** 分页拉取歌单曲目：offset 起始偏移，limit 每页数量（服务端上限 1000），按歌单顺序返回 */
export function fetchPlaylistTracks(
  id: number,
  params: { limit: number, offset: number },
  fetcher: typeof fetch = fetch,
): Promise<NcmSong[]> {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) })
  return ncmFetchJson<{ songs: NcmSong[] }>(`/api/playlist/${id}/tracks?${query}`, undefined, fetcher)
    .then(page => page.songs)
}
