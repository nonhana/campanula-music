import type { NcmSearchPage } from '$lib/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchNcm } from './search'

const songPage: NcmSearchPage = {
  type: 'song',
  total: 1,
  songs: [
    {
      id: 186016,
      name: '晴天',
      duration: 269000,
      artists: [{ id: 6452, name: '周杰伦' }],
      album: { id: 21349, name: '叶惠美', cover: '' },
    },
  ],
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('searchNcm', () => {
  it('按关键词与类型请求 /api/search 并返回结果页', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(songPage),
    })

    await expect(searchNcm({ keywords: '稻香', type: 'song' })).resolves.toEqual(songPage)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/search?keywords=%E7%A8%BB%E9%A6%99&type=song&limit=30'),
      expect.any(Object),
    )
  })

  it('请求支持传入 type 与 limit', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(songPage) })

    await searchNcm({ keywords: '周杰伦', type: 'playlist', limit: 10 })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('type=playlist&limit=10'),
      expect.any(Object),
    )
  })

  describe('错误响应解码为共享客户端错误', () => {
    it('带错误码的 JSON 保留码与消息', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } }),
      })

      await expect(searchNcm({ keywords: 'x', type: 'song' })).rejects.toMatchObject({
        name: 'NcmClientError',
        code: 'RATE_LIMITED',
        message: '请求过于频繁，请稍后再试',
      })
    })

    it('响应体异常时回落 UNKNOWN', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('bad json')),
      })

      await expect(searchNcm({ keywords: 'x', type: 'song' })).rejects.toMatchObject({
        name: 'NcmClientError',
        code: 'UNKNOWN',
      })
    })
  })

  it('网络异常原样透传（由调用方判定中止）', async () => {
    const abortError = new DOMException('aborted', 'AbortError')
    globalThis.fetch = vi.fn().mockRejectedValue(abortError)

    await expect(() => searchNcm({ keywords: 'x', type: 'song' }, new AbortController().signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
