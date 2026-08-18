import type { LyricItem } from '$lib/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchLyric } from './lyrics'

const lyrics: LyricItem[] = [
  { time: 1000, text: '第一句', translate: null },
  { time: 3500, text: '第二句', translate: 'Second line' },
]

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('fetchLyric', () => {
  it('按歌曲 id 请求 /api/songs/lyric 并返回歌词列表', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(lyrics),
    })

    await expect(fetchLyric(186016)).resolves.toEqual(lyrics)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/songs/lyric?id=186016',
      expect.any(Object),
    )
  })

  it('无歌词（空数组）如实透传，不视为失败', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    await expect(fetchLyric(6452)).resolves.toEqual([])
  })

  it('被限流（429）解码为 RATE_LIMITED 客户端错误', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } }),
    })

    await expect(fetchLyric(1)).rejects.toMatchObject({
      name: 'NcmClientError',
      code: 'RATE_LIMITED',
      message: '请求过于频繁，请稍后再试',
    })
  })

  it('网络异常原样透传（由调用方判定中止）', async () => {
    const abortError = new DOMException('aborted', 'AbortError')
    globalThis.fetch = vi.fn().mockRejectedValue(abortError)

    await expect(fetchLyric(1)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
