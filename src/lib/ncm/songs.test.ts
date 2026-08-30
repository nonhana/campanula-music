import type { NcmSong, NcmSongSource } from '$lib/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSongUrls, toSongItem } from './songs'

const sources: NcmSongSource[] = [
  { id: 186016, status: 'playable', url: 'https://m701.music.126.net/a.mp3', trial: null },
]

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('fetchSongUrls', () => {
  it('按 ids 与音质档位请求 /api/songs/url 并返回来源列表', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sources),
    })

    await expect(fetchSongUrls([186016], 'standard')).resolves.toEqual(sources)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/songs/url?ids=186016&level=standard',
      expect.any(Object),
    )
  })

  it('缺省音质档位回落 standard', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sources),
    })

    await fetchSongUrls([1])

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/songs/url?ids=1&level=standard',
      expect.any(Object),
    )
  })

  it('未绑定（401）解码为 UNAUTHENTICATED 客户端错误', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { code: 'UNAUTHENTICATED', message: '播放歌曲需要账号许可：请先绑定网易云账号' } }),
    })

    await expect(fetchSongUrls([1])).rejects.toMatchObject({
      name: 'NcmClientError',
      code: 'UNAUTHENTICATED',
      message: '播放歌曲需要账号许可：请先绑定网易云账号',
    })
  })

  it('参数校验码（INVALID_PARAMS）消息照常透传', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: { code: 'INVALID_PARAMS', message: '缺少有效的 ids 参数' } }),
    })

    await expect(fetchSongUrls([1])).rejects.toMatchObject({
      name: 'NcmClientError',
      code: 'INVALID_PARAMS',
      message: '缺少有效的 ids 参数',
    })
  })

  it('网络异常原样透传（由调用方判定中止）', async () => {
    const abortError = new DOMException('aborted', 'AbortError')
    globalThis.fetch = vi.fn().mockRejectedValue(abortError)

    await expect(fetchSongUrls([1])).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('toSongItem', () => {
  it('把领域歌曲映射为播放链路 SongItem（sourceId 取网易云 id）', () => {
    const song: NcmSong = {
      id: 186016,
      name: '晴天',
      artists: [{ id: 6452, name: '周杰伦' }],
      album: { id: 21349, name: '叶惠美', cover: 'https://p1.music.126.net/c.jpg' },
      duration: 269000,
    }

    expect(toSongItem(song)).toEqual({
      id: 186016,
      name: '晴天',
      cover: 'https://p1.music.126.net/c.jpg',
      alias: [],
      artists: [{ id: 6452, name: '周杰伦' }],
      album: { id: 21349, name: '叶惠美', cover: 'https://p1.music.126.net/c.jpg' },
      duration: 269000,
      sourceId: '186016',
    })
  })
})
