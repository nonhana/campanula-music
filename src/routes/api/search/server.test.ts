import type { NcmSearchPage } from '$lib/types'
import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmSearch } from '$lib/server/ncm/search'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

vi.mock('$lib/server/binding', () => ({
  resolveBoundUser: vi.fn(),
}))

vi.mock('$lib/server/ncm/search', () => ({
  ncmSearch: vi.fn(),
}))

const mockedBound = vi.mocked(resolveBoundUser)
const mockedSearch = vi.mocked(ncmSearch)

function makeEvent(query = ''): RequestEvent {
  return { url: new URL(`http://localhost/api/search${query}`) } as RequestEvent
}

const songPage: NcmSearchPage = { type: 'song', total: 1, songs: [{ id: 1, name: '稻香', duration: 1000, artists: [], album: { id: 0, name: '', cover: '' } }] }

beforeEach(() => {
  mockedBound.mockReset()
  mockedSearch.mockReset()
  mockedBound.mockResolvedValue(null)
})

describe('gET /api/search', () => {
  it('有效参数：以假 provider 响应回传搜索结果', async () => {
    mockedSearch.mockResolvedValue(songPage)

    const res = await GET(makeEvent('?keywords=稻香&type=song'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(songPage)
  })

  it('把关键词、类型与分页转发给门面；未绑定时传空凭据', async () => {
    mockedSearch.mockResolvedValue(songPage)

    await GET(makeEvent('?keywords=%E7%A8%BB%E9%A6%99&type=song&limit=20'))

    expect(mockedSearch).toHaveBeenCalledWith(
      { cookie: '' },
      { keywords: '稻香', type: 'song', limit: 20, offset: 0 },
    )
  })

  it('已绑定时携带绑定凭据（搜索无需登录，但不失账号许可上下文）', async () => {
    mockedBound.mockResolvedValue({ uid: 98765, cookie: 'MUSIC_U=abc' })
    mockedSearch.mockResolvedValue(songPage)

    await GET(makeEvent('?keywords=%E7%A8%BB%E9%A6%99&type=song'))

    expect(mockedSearch).toHaveBeenCalledWith(
      { cookie: 'MUSIC_U=abc' },
      { keywords: '稻香', type: 'song', limit: 30, offset: 0 },
    )
  })

  it('limit 非法时回落默认 30', async () => {
    mockedSearch.mockResolvedValue(songPage)

    await GET(makeEvent('?keywords=x&type=song&limit=abc'))

    expect(mockedSearch).toHaveBeenCalledWith({ cookie: '' }, { keywords: 'x', type: 'song', limit: 30, offset: 0 })
  })

  it('缺少关键词 → 400 INVALID_PARAMS', async () => {
    const res = await GET(makeEvent('?type=song'))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'INVALID_PARAMS' } })
    expect(mockedSearch).not.toHaveBeenCalled()
  })

  it('空白关键词 → 400 INVALID_PARAMS', async () => {
    const res = await GET(makeEvent('?keywords=%20%20&type=song'))

    expect(res.status).toBe(400)
  })

  it('类型非法 → 400 INVALID_PARAMS', async () => {
    const res = await GET(makeEvent('?keywords=稻香&type=album'))

    expect(res.status).toBe(400)
  })

  it('被限流 → 429 且带错误码', async () => {
    mockedSearch.mockRejectedValue(new NcmError('RATE_LIMITED', '请求过于频繁，请稍后再试', { status: 429 }))

    const res = await GET(makeEvent('?keywords=稻香&type=song'))

    expect(res.status).toBe(429)
    await expect(res.json()).resolves.toEqual({ error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } })
  })

  it('绑定失效且无上游状态 → 401 且带错误码', async () => {
    mockedSearch.mockRejectedValue(new NcmError('UNAUTHENTICATED', '绑定已失效'))

    const res = await GET(makeEvent('?keywords=稻香&type=song'))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: { code: 'UNAUTHENTICATED', message: '绑定已失效' } })
  })

  it('门面抛非领域异常 → 500 UNKNOWN', async () => {
    mockedSearch.mockRejectedValue(new Error('boom'))

    const res = await GET(makeEvent('?keywords=稻香&type=song'))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNKNOWN' } })
  })
})
