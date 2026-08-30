import type { NcmSong } from '$lib/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchLikedSongs, likeSong } from './likes'

const songs: NcmSong[] = [
  {
    id: 186016,
    name: '歌曲A',
    artists: [{ id: 1, name: '歌手A' }],
    album: { id: 2, name: '专辑B', cover: 'https://p1.music.126.net/a.jpg' },
    duration: 180000,
  },
]

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('likeSong', () => {
  it('按歌曲 id 与红心状态 POST 写回', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    })

    await expect(likeSong(186016, true)).resolves.toBeUndefined()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/songs/like',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 186016, like: true }),
      }),
    )
  })

  it('取消红心（like: false）原样提交', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    })

    await likeSong(6452, false)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/songs/like',
      expect.objectContaining({ body: JSON.stringify({ id: 6452, like: false }) }),
    )
  })

  it('未绑定（401）解码为 UNAUTHENTICATED 客户端错误', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { code: 'UNAUTHENTICATED', message: '红心需要账号许可：请先绑定网易云账号' } }),
    })

    await expect(likeSong(1, true)).rejects.toMatchObject({
      name: 'NcmClientError',
      code: 'UNAUTHENTICATED',
      message: '红心需要账号许可：请先绑定网易云账号',
    })
  })

  it('网络异常原样透传（由调用方判定中止）', async () => {
    const abortError = new DOMException('aborted', 'AbortError')
    globalThis.fetch = vi.fn().mockRejectedValue(abortError)

    await expect(likeSong(1, true)).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('fetchLikedSongs', () => {
  it('请求 /api/songs/liked 并返回红心歌曲列表', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(songs),
    })

    await expect(fetchLikedSongs()).resolves.toEqual(songs)

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/songs/liked', expect.any(Object))
  })

  it('无红心歌曲时返回空数组', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    await expect(fetchLikedSongs()).resolves.toEqual([])
  })

  it('未绑定（401）解码为 UNAUTHENTICATED 客户端错误', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { code: 'UNAUTHENTICATED', message: '查看我喜欢的音乐需要账号许可：请先绑定网易云账号' } }),
    })

    await expect(fetchLikedSongs()).rejects.toMatchObject({
      name: 'NcmClientError',
      code: 'UNAUTHENTICATED',
      message: '查看我喜欢的音乐需要账号许可：请先绑定网易云账号',
    })
  })

  it('参数校验码（INVALID_PARAMS）消息照常透传', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: { code: 'INVALID_PARAMS', message: '缺少有效的参数' } }),
    })

    await expect(fetchLikedSongs()).rejects.toMatchObject({
      name: 'NcmClientError',
      code: 'INVALID_PARAMS',
      message: '缺少有效的参数',
    })
  })
})
