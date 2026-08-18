/**
 * 歌词链路的客户端数据入口（歌词获取）。
 *
 * 播放编排只经本模块访问 /api/songs/lyric（服务端网易云门面的薄代理），
 * 测试注入假 provider 响应即由此处替换（vi.mock 本模块）。
 */
import type { LyricItem, NcmErrorCode } from '$lib/types'
import { ncmFetchJson } from './client'

/** 错误码 → 歌词链路文案（satisfies 保证新增错误码必须在编译期补齐文案） */
export const LYRIC_ERROR_TEXT = {
  UNAUTHENTICATED: '获取歌词需要账号许可：请先绑定网易云账号',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  RESOURCE_UNAVAILABLE: '该歌曲歌词暂不可用（无版权）',
  UNKNOWN: '获取歌词失败，请稍后再试',
} satisfies Record<NcmErrorCode, string>

/** 按歌曲 id 拉取歌词；无歌词/未收录由服务端如实返回空数组，不视为失败 */
export function fetchLyric(id: number, signal?: AbortSignal): Promise<LyricItem[]> {
  return ncmFetchJson<LyricItem[]>(`/api/songs/lyric?id=${id}`, signal)
}
