import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmLikedList } from '$lib/server/ncm/like'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

vi.mock('$lib/server/binding', () => ({
  resolveBoundUser: vi.fn(),
}))

vi.mock('$lib/server/ncm/like', () => ({
  ncmLikedList: vi.fn(),
}))

const mockedBound = vi.mocked(resolveBoundUser)
const mockedLikedList = vi.mocked(ncmLikedList)

function makeEvent(): RequestEvent {
  return { url: new URL('http://localhost/api/songs/liked/ids') } as RequestEvent
}

beforeEach(() => {
  mockedBound.mockReset()
  mockedLikedList.mockReset()
})

describe('gET /api/songs/liked/ids', () => {
  it('未绑定时返回 401 UNAUTHENTICATED 引导文案，不调用门面', async () => {
    mockedBound.mockResolvedValue(null)

    const res = await GET(makeEvent())

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
    expect(mockedLikedList).not.toHaveBeenCalled()
  })

  it('已绑定时以绑定凭据与账号 id 拉取红心 id 列表', async () => {
    mockedBound.mockResolvedValue({ uid: 98765, cookie: 'MUSIC_U=abc' })
    mockedLikedList.mockResolvedValue([2, 1])

    const res = await GET(makeEvent())

    expect(mockedLikedList).toHaveBeenCalledWith({ cookie: 'MUSIC_U=abc' }, 98765)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual([2, 1])
  })

  it('绑定失效（门面抛 UNAUTHENTICATED）→ 401 且带错误码', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })
    mockedLikedList.mockRejectedValue(new NcmError('UNAUTHENTICATED', '绑定已失效，需要重新扫码'))

    const res = await GET(makeEvent())

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
  })

  it('门面抛非领域异常 → 500 UNKNOWN', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })
    mockedLikedList.mockRejectedValue(new Error('boom'))

    const res = await GET(makeEvent())

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNKNOWN' } })
  })
})
