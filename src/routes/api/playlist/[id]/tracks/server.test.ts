import type { NcmSong } from '$lib/types'
import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmPlaylistTracks } from '$lib/server/ncm/playlists'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

vi.mock('$lib/server/binding', () => ({
  resolveBoundUser: vi.fn(),
}))

vi.mock('$lib/server/ncm/playlists', () => ({
  ncmPlaylistTracks: vi.fn(),
}))

const mockedBound = vi.mocked(resolveBoundUser)
const mockedTracks = vi.mocked(ncmPlaylistTracks)

const songs: NcmSong[] = [
  { id: 186016, name: '晴天', duration: 269000, artists: [], album: { id: 0, name: '', cover: '' } },
]

function makeEvent(id: string, query = ''): RequestEvent {
  return { params: { id }, url: new URL(`http://localhost/api/playlist/${id}${query}`) } as RequestEvent
}

beforeEach(() => {
  mockedBound.mockReset()
  mockedTracks.mockReset()
  mockedBound.mockResolvedValue(null)
})

describe('gET /api/playlist/[id]/tracks', () => {
  it('默认分页 limit=100 offset=0，返回 { songs }；未绑定时传空凭据', async () => {
    mockedTracks.mockResolvedValue(songs)

    const res = await GET(makeEvent('6792103822'))

    expect(mockedTracks).toHaveBeenCalledWith({ cookie: '' }, 6792103822, { limit: 100, offset: 0 })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ songs })
  })

  it('自定义分页参数透传，limit 超上限收敛到 1000', async () => {
    mockedTracks.mockResolvedValue([])

    await GET(makeEvent('1', '?limit=5000&offset=200'))

    expect(mockedTracks).toHaveBeenCalledWith({ cookie: '' }, 1, { limit: 1000, offset: 200 })
  })

  it('已绑定时携带绑定凭据', async () => {
    mockedBound.mockResolvedValue({ uid: 98765, cookie: 'MUSIC_U=abc' })
    mockedTracks.mockResolvedValue([])

    await GET(makeEvent('6792103822'))

    expect(mockedTracks).toHaveBeenCalledWith({ cookie: 'MUSIC_U=abc' }, 6792103822, { limit: 100, offset: 0 })
  })

  it('id 非纯数字 → 400 INVALID_PARAMS', async () => {
    const res = await GET(makeEvent('abc'))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'INVALID_PARAMS' } })
    expect(mockedTracks).not.toHaveBeenCalled()
  })

  it('分页参数非整数 → 400 INVALID_PARAMS', async () => {
    const res = await GET(makeEvent('1', '?limit=abc&offset=-1'))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'INVALID_PARAMS' } })
    expect(mockedTracks).not.toHaveBeenCalled()
  })

  it('歌单不存在（未认证/资源不可用）→ 404 且带错误码', async () => {
    mockedTracks.mockRejectedValue(new NcmError('RESOURCE_UNAVAILABLE', '资源不可用'))

    const res = await GET(makeEvent('999'))

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'RESOURCE_UNAVAILABLE' } })
  })

  it('门面抛非领域异常 → 500 UNKNOWN', async () => {
    mockedTracks.mockRejectedValue(new Error('boom'))

    const res = await GET(makeEvent('1'))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNKNOWN' } })
  })
})
