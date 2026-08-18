import type { NcmUserPlaylists } from '$lib/types'
import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmUserPlaylists } from '$lib/server/ncm/playlists'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

vi.mock('$lib/server/binding', () => ({
  resolveBoundUser: vi.fn(),
}))

vi.mock('$lib/server/ncm/playlists', () => ({
  ncmUserPlaylists: vi.fn(),
}))

const mockedBound = vi.mocked(resolveBoundUser)
const mockedPlaylists = vi.mocked(ncmUserPlaylists)

const groups: NcmUserPlaylists = {
  created: [{ id: 1, name: '我的创建', cover: '', trackCount: 3, playCount: 10, creator: '甲' }],
  collected: [{ id: 2, name: '收藏的', cover: '', trackCount: 5, playCount: 20, creator: '乙' }],
}

function makeEvent(): RequestEvent {
  return { url: new URL('http://localhost/api/playlists') } as RequestEvent
}

beforeEach(() => {
  mockedBound.mockReset()
  mockedPlaylists.mockReset()
})

describe('gET /api/playlists', () => {
  it('未绑定时返回 401 UNAUTHENTICATED 引导文案，不调用门面', async () => {
    mockedBound.mockResolvedValue(null)

    const res = await GET(makeEvent())

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
    expect(mockedPlaylists).not.toHaveBeenCalled()
  })

  it('已绑定时以绑定凭据与账号 id 拉取两组歌单', async () => {
    mockedBound.mockResolvedValue({ uid: 98765, cookie: 'MUSIC_U=abc' })
    mockedPlaylists.mockResolvedValue(groups)

    const res = await GET(makeEvent())

    expect(mockedPlaylists).toHaveBeenCalledWith({ cookie: 'MUSIC_U=abc' }, 98765)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(groups)
  })

  it('门面被限流 → 429 且带错误码', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })
    mockedPlaylists.mockRejectedValue(new NcmError('RATE_LIMITED', '请求过于频繁，请稍后再试', { status: 429 }))

    const res = await GET(makeEvent())

    expect(res.status).toBe(429)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'RATE_LIMITED' } })
  })

  it('门面抛非领域异常 → 500 UNKNOWN', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })
    mockedPlaylists.mockRejectedValue(new Error('boom'))

    const res = await GET(makeEvent())

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNKNOWN' } })
  })
})
