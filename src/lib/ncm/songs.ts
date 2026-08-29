/**
 * 播放链路的客户端数据入口（播放地址获取）。
 *
 * 页面与播放编排只经本模块访问 /api/songs/url（服务端网易云门面的薄代理），
 * 测试注入假 provider 响应即由此处替换（vi.mock 本模块）。
 */
import type { NcmErrorCode, NcmSong, NcmSongSource, NcmSoundLevel, SongItem } from '$lib/types'
import { DEFAULT_SOUND_LEVEL } from '$lib/soundLevel'
import { ncmFetchJson } from './client'

/** 错误码 → 播放链路文案（satisfies 保证新增错误码必须在编译期补齐文案） */
export const SONG_URL_ERROR_TEXT = {
  UNAUTHENTICATED: '播放歌曲需要账号许可：请先绑定网易云账号',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  RESOURCE_UNAVAILABLE: '该资源暂不可用',
  UNKNOWN: '获取播放地址失败，请稍后再试',
} satisfies Record<NcmErrorCode, string>

/** 按音质档位拉取一批歌曲的播放来源（命中试听片段/无版权由服务端如实标注） */
export function fetchSongUrls(
  ids: number[],
  level: NcmSoundLevel = DEFAULT_SOUND_LEVEL,
  signal?: AbortSignal,
): Promise<NcmSongSource[]> {
  const params = new URLSearchParams({ ids: ids.join(','), level })
  return ncmFetchJson<NcmSongSource[]>(`/api/songs/url?${params}`, signal)
}

/** 把领域歌曲映射为播放链路使用的 SongItem（sourceId 取网易云歌曲 id） */
export function toSongItem(song: NcmSong): SongItem {
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
