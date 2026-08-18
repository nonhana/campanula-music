import type { NcmSong } from '$lib/types'
import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmLikedSongs } from '$lib/server/ncm/like'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

vi.mock('$lib/server/binding', () => ({
  resolveBoundUser: vi.fn(),
}))

vi.mock('$lib/server/ncm/like', () => ({
  ncmLikedSongs: vi.fn(),
}))

const mockedBound = vi.mocked(resolveBoundUser)
const mockedLikedSongs = vi.mocked(ncmLikedSongs)

function makeEvent(): RequestEvent {
  return { url: new URL('http://localhost/api/songs/liked') } as RequestEvent
}

const songs: NcmSong[] = [
  {
    id: 186016,
    name: '歌曲A',
    artists: [{ id: 1, name: '歌手A' }],
    album: { id: 2, name: '专辑B', cover: 'https://p1.music.126.net/a.jpg' },
    duration: 180000,
  },
]

beforeEach(() => {
  mockedBound.mockReset()
  mockedLikedSongs.mockReset()
})

describe('gET /api/songs/liked', () => {
  it('未绑定时返回 401 UNAUTHENTICATED 引导文案，不调用门面', async () => {
    mockedBound.mockResolvedValue(null)

    const res = await GET(makeEvent())

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
    expect(mockedLikedSongs).not.toHaveBeenCalled()
  })

  it('已绑定时以绑定凭据与账号 id 拉取红心歌曲列表', async () => {
    mockedBound.mockResolvedValue({ uid: 98765, cookie: 'MUSIC_U=abc' })
    mockedLikedSongs.mockResolvedValue(songs)

    const res = await GET(makeEvent())

    expect(mockedLikedSongs).toHaveBeenCalledWith({ cookie: 'MUSIC_U=abc' }, 98765)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(songs)
  })

  it('无红心歌曲时返回空数组', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })
    mockedLikedSongs.mockResolvedValue([])

    const res = await GET(makeEvent())

    await expect(res.json()).resolves.toEqual([])
  })

  it('绑定失效（门面抛 UNAUTHENTICATED）→ 401 且带错误码', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })
    mockedLikedSongs.mockRejectedValue(new NcmError('UNAUTHENTICATED', '绑定已失效，需要重新扫码'))

    const res = await GET(makeEvent())

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
  })

  it('门面抛非领域异常 → 500 UNKNOWN', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })
    mockedLikedSongs.mockRejectedValue(new Error('boom'))

    const res = await GET(makeEvent())

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNKNOWN' } })
  })
})
