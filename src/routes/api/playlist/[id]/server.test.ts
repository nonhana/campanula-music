import type { NcmPlaylistDetail } from '$lib/types'
import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmPlaylistDetail } from '$lib/server/ncm/playlists'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

vi.mock('$lib/server/binding', () => ({
  resolveBoundUser: vi.fn(),
}))

vi.mock('$lib/server/ncm/playlists', () => ({
  ncmPlaylistDetail: vi.fn(),
}))

const mockedBound = vi.mocked(resolveBoundUser)
const mockedDetail = vi.mocked(ncmPlaylistDetail)

const detail: NcmPlaylistDetail = {
  id: 6792103822,
  name: '周杰伦精选',
  cover: 'https://p1.music.126.net/abc.jpg',
  creator: 'Buradarrr',
  description: '经典曲目',
  trackCount: 1,
  playCount: 32251352,
}

function makeEvent(id: string): RequestEvent {
  return { params: { id }, url: new URL(`http://localhost/api/playlist/${id}`) } as RequestEvent
}

beforeEach(() => {
  mockedBound.mockReset()
  mockedDetail.mockReset()
  mockedBound.mockResolvedValue(null)
})

describe('gET /api/playlist/[id]', () => {
  it('有效 id：返回歌单头信息；未绑定时传空凭据', async () => {
    mockedDetail.mockResolvedValue(detail)

    const res = await GET(makeEvent('6792103822'))

    expect(mockedDetail).toHaveBeenCalledWith({ cookie: '' }, 6792103822)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(detail)
  })

  it('已绑定时携带绑定凭据（未登录歌曲补全受限）', async () => {
    mockedBound.mockResolvedValue({ uid: 98765, cookie: 'MUSIC_U=abc' })
    mockedDetail.mockResolvedValue(detail)

    await GET(makeEvent('6792103822'))

    expect(mockedDetail).toHaveBeenCalledWith({ cookie: 'MUSIC_U=abc' }, 6792103822)
  })

  it('id 非纯数字 → 400 INVALID_PARAMS', async () => {
    const res = await GET(makeEvent('abc'))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'INVALID_PARAMS' } })
    expect(mockedDetail).not.toHaveBeenCalled()
  })

  it('歌单不存在（未认证/资源不可用）→ 404 且带错误码', async () => {
    mockedDetail.mockRejectedValue(new NcmError('RESOURCE_UNAVAILABLE', '资源不可用'))

    const res = await GET(makeEvent('999'))

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'RESOURCE_UNAVAILABLE' } })
  })

  it('门面抛非领域异常 → 500 UNKNOWN', async () => {
    mockedDetail.mockRejectedValue(new Error('boom'))

    const res = await GET(makeEvent('1'))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNKNOWN' } })
  })
})
