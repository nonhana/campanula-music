import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmLikedPage } from '$lib/server/ncm/like'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

vi.mock('$lib/server/binding', () => ({
  resolveBoundUser: vi.fn(),
}))

vi.mock('$lib/server/ncm/like', () => ({
  ncmLikedPage: vi.fn(),
}))

const mockedBound = vi.mocked(resolveBoundUser)
const mockedLikedPage = vi.mocked(ncmLikedPage)

function makeEvent(query = ''): RequestEvent {
  return { url: new URL(`http://localhost/api/songs/liked${query}`) } as RequestEvent
}

beforeEach(() => {
  mockedBound.mockReset()
  mockedLikedPage.mockReset()
})

describe('gET /api/songs/liked', () => {
  it('未绑定时返回 401 UNAUTHENTICATED 引导文案，不调用门面', async () => {
    mockedBound.mockResolvedValue(null)

    const res = await GET(makeEvent())

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
    expect(mockedLikedPage).not.toHaveBeenCalled()
  })

  it('无分页参数时以绑定凭据请求全量并透传 { songs, total }', async () => {
    mockedBound.mockResolvedValue({ uid: 98765, cookie: 'MUSIC_U=abc' })
    mockedLikedPage.mockResolvedValue({ songs: [], total: 0 })

    const res = await GET(makeEvent())

    expect(mockedLikedPage).toHaveBeenCalledWith({ cookie: 'MUSIC_U=abc' }, 98765, undefined)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ songs: [], total: 0 })
  })

  it('携带 limit/offset 时按分页请求', async () => {
    mockedBound.mockResolvedValue({ uid: 98765, cookie: 'MUSIC_U=abc' })
    mockedLikedPage.mockResolvedValue({ songs: [], total: 4812 })

    const res = await GET(makeEvent('?limit=100&offset=200'))

    expect(mockedLikedPage).toHaveBeenCalledWith(
      { cookie: 'MUSIC_U=abc' },
      98765,
      { limit: 100, offset: 200 },
    )
    await expect(res.json()).resolves.toEqual({ songs: [], total: 4812 })
  })

  it('分页参数非整数或为负 → 400 INVALID_PARAMS', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })

    for (const query of ['?limit=abc&offset=0', '?limit=100&offset=-1', '?limit=1.5&offset=0']) {
      const res = await GET(makeEvent(query))
      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toMatchObject({ error: { code: 'INVALID_PARAMS' } })
    }
    expect(mockedLikedPage).not.toHaveBeenCalled()
  })

  it('绑定失效（门面抛 UNAUTHENTICATED）→ 401 且带错误码', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })
    mockedLikedPage.mockRejectedValue(new NcmError('UNAUTHENTICATED', '绑定已失效，需要重新扫码'))

    const res = await GET(makeEvent())

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
  })

  it('门面抛非领域异常 → 500 UNKNOWN', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })
    mockedLikedPage.mockRejectedValue(new Error('boom'))

    const res = await GET(makeEvent())

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNKNOWN' } })
  })
})
