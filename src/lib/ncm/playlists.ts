/**
 * 歌单页面的客户端数据入口（我的歌单 / 歌单详情）。
 *
 * 页面只经本模块访问服务端网易云门面的薄代理，
 * 测试注入假 provider 响应即由此处替换（vi.mock 本模块）。
 */
import type { NcmErrorCode, NcmPlaylistDetail, NcmUserPlaylists } from '$lib/types'
import { ncmFetchJson } from './client'

/** 错误码 → 页面文案（satisfies 保证新增错误码必须在编译期补齐文案） */
export const PLAYLIST_ERROR_TEXT = {
  UNAUTHENTICATED: '查看歌单需要账号许可：请先绑定网易云账号',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  RESOURCE_UNAVAILABLE: '该资源暂不可用',
  UNKNOWN: '获取歌单失败，请稍后再试',
} satisfies Record<NcmErrorCode, string>

/** 拉取我的歌单：创建的歌单与收藏的歌单两组 */
export function fetchUserPlaylists(signal?: AbortSignal): Promise<NcmUserPlaylists> {
  return ncmFetchJson<NcmUserPlaylists>('/api/playlists', signal)
}

/** 按 id 拉取歌单详情（服务端已用完整 trackIds 补全全部歌曲） */
export function fetchPlaylistDetail(id: number, signal?: AbortSignal): Promise<NcmPlaylistDetail> {
  return ncmFetchJson<NcmPlaylistDetail>(`/api/playlist/${id}`, signal)
}
