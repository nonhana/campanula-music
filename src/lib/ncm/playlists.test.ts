import type { NcmPlaylistDetail, NcmUserPlaylists } from '$lib/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPlaylistDetail, fetchUserPlaylists } from './playlists'

const groups: NcmUserPlaylists = {
  created: [{ id: 1, name: '我的创建', cover: '', trackCount: 3, playCount: 10, creator: '甲' }],
  collected: [],
}

const detail: NcmPlaylistDetail = {
  id: 6792103822,
  name: '周杰伦精选',
  cover: 'https://p1.music.126.net/abc.jpg',
  creator: 'Buradarrr',
  description: null,
  trackCount: 3,
  playCount: 32251352,
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('fetchUserPlaylists', () => {
  it('请求 /api/playlists 并返回两组歌单', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(groups),
    })

    await expect(fetchUserPlaylists()).resolves.toEqual(groups)

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/playlists', expect.any(Object))
  })

  it('未绑定（401）解码为 UNAUTHENTICATED 客户端错误', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { code: 'UNAUTHENTICATED', message: '查看歌单需要账号许可：请先绑定网易云账号' } }),
    })

    await expect(fetchUserPlaylists()).rejects.toMatchObject({
      name: 'NcmClientError',
      code: 'UNAUTHENTICATED',
      message: '查看歌单需要账号许可：请先绑定网易云账号',
    })
  })

  it('响应体异常时回落 UNKNOWN', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('bad json')),
    })

    await expect(fetchUserPlaylists()).rejects.toMatchObject({ name: 'NcmClientError', code: 'UNKNOWN' })
  })

  it('非领域码（参数校验）消息照常透传，码降级 UNKNOWN', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: { code: 'INVALID_PARAMS', message: '缺少有效的歌单 id' } }),
    })

    await expect(fetchUserPlaylists()).rejects.toMatchObject({
      name: 'NcmClientError',
      code: 'UNKNOWN',
      message: '缺少有效的歌单 id',
    })
  })
})

describe('fetchPlaylistDetail', () => {
  it('按 id 请求 /api/playlist/[id] 并返回头信息', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(detail),
    })

    await expect(fetchPlaylistDetail(detail.id)).resolves.toEqual(detail)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/playlist/6792103822',
      expect.any(Object),
    )
  })

  it('服务端错误码解码为客户端错误', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } }),
    })

    await expect(fetchPlaylistDetail(1)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('网络异常原样透传（由调用方判定中止）', async () => {
    const abortError = new DOMException('aborted', 'AbortError')
    globalThis.fetch = vi.fn().mockRejectedValue(abortError)

    await expect(fetchPlaylistDetail(1)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
