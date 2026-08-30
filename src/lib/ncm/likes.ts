/**
 * 红心链路的客户端数据入口（红心写回 / 我喜欢的音乐）。
 *
 * 页面与红心编排只经本模块访问 /api/songs/like 与 /api/songs/liked
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

/** 红心 / 取消红心，写回账号；失败抛 NcmClientError，网络异常原样透传 */
export async function likeSong(id: number, like: boolean, signal?: AbortSignal): Promise<void> {
  await ncmFetchJsonPost<{ ok: true }>('/api/songs/like', { id, like }, signal)
}

/** 我喜欢的音乐歌曲列表（服务端已按红心时间倒序补全歌曲详情） */
export function fetchLikedSongs(signal?: AbortSignal): Promise<NcmSong[]> {
  return ncmFetchJson<NcmSong[]>('/api/songs/liked', signal)
}
