/**
 * 红心链路的客户端数据入口（红心写回 / 我喜欢的音乐 id 列表 / 分页歌曲列表）。
 *
 * 页面与红心编排只经本模块访问 /api/songs/like 与 /api/songs/liked*
 * （服务端网易云门面的薄代理），测试注入假 provider 响应即由此处替换（vi.mock 本模块）。
 */
import type { NcmErrorCode, NcmSong } from '$lib/types'
import { ncmFetchJson, ncmFetchJsonPost } from './client'

/** 错误码 → 红心链路文案（satisfies 保证新增错误码必须在编译期补齐文案） */
export const LIKE_ERROR_TEXT = {
  UNAUTHENTICATED: '红心需要账号许可：请先绑定网易云账号',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  RESOURCE_UNAVAILABLE: '该歌曲暂不可用',
  INVALID_PARAMS: '请求参数不合法，请检查后重试',
  UNKNOWN: '红心操作失败，请稍后再试',
} satisfies Record<NcmErrorCode, string>

/** 浏览用分页大小：我喜欢的音乐首屏与触底增量的每页曲目数（与歌单页对齐） */
export const LIKED_PAGE_SIZE = 100

/** 红心 / 取消红心，写回账号；失败抛 NcmClientError，网络异常原样透传 */
export async function likeSong(id: number, like: boolean, signal?: AbortSignal): Promise<void> {
  await ncmFetchJsonPost<{ ok: true }>('/api/songs/like', { id, like }, signal)
}

/** 我喜欢的音乐 id 列表（按红心时间倒序；红心状态只需 id，无需歌曲详情） */
export function fetchLikedSongIds(signal?: AbortSignal): Promise<number[]> {
  return ncmFetchJson<number[]>('/api/songs/liked/ids', signal)
}

/** 分页拉取我喜欢的音乐：offset 起始偏移，limit 每页数量；total 恒为红心总数；fetcher 供服务端 load 注入 event.fetch */
export function fetchLikedPage(
  params: { limit: number, offset: number },
  fetcher: typeof fetch = fetch,
): Promise<{ songs: NcmSong[], total: number }> {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) })
  return ncmFetchJson<{ songs: NcmSong[], total: number }>(`/api/songs/liked?${query}`, undefined, fetcher)
}

/** 我喜欢的音乐全量歌曲列表（服务端按红心时间倒序补全详情）；播放队列补全等整表场景使用 */
export async function fetchLikedSongs(signal?: AbortSignal): Promise<NcmSong[]> {
  const page = await ncmFetchJson<{ songs: NcmSong[], total: number }>('/api/songs/liked', signal)
  return page.songs
}
