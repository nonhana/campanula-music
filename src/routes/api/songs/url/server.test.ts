import type { NcmSongSource } from '$lib/types'
import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmSongUrl } from '$lib/server/ncm/songUrl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

vi.mock('$lib/server/binding', () => ({
  resolveBoundUser: vi.fn(),
}))

vi.mock('$lib/server/ncm/songUrl', () => ({
  ncmSongUrl: vi.fn(),
}))

const mockedBound = vi.mocked(resolveBoundUser)
const mockedSongUrl = vi.mocked(ncmSongUrl)

function makeEvent(query = ''): RequestEvent {
  return { url: new URL(`http://localhost/api/songs/url${query}`) } as RequestEvent
}

const sources: NcmSongSource[] = [
  { id: 186016, status: 'playable', url: 'https://m701.music.126.net/a.mp3', trial: null },
]

beforeEach(() => {
  mockedBound.mockReset()
  mockedSongUrl.mockReset()
  mockedBound.mockResolvedValue(null)
})

describe('gET /api/songs/url', () => {
  it('ids 参数转发给门面并回传来源列表；未绑定时传空凭据', async () => {
    mockedSongUrl.mockResolvedValue(sources)

    const res = await GET(makeEvent('?ids=186016&level=standard'))

    expect(mockedSongUrl).toHaveBeenCalledWith(
      { cookie: '' },
      { ids: [186016], level: 'standard' },
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(sources)
  })

  it('已绑定时携带绑定凭据（账号许可决定试听片段回落与否）', async () => {
    mockedBound.mockResolvedValue({ uid: 98765, cookie: 'MUSIC_U=abc' })
    mockedSongUrl.mockResolvedValue(sources)

    await GET(makeEvent('?ids=186016'))

    expect(mockedSongUrl).toHaveBeenCalledWith(
      { cookie: 'MUSIC_U=abc' },
      { ids: [186016], level: 'standard' },
    )
  })

  it('多个 id 以逗号分隔解析为数字数组', async () => {
    mockedSongUrl.mockResolvedValue(sources)

    await GET(makeEvent('?ids=186016,347230'))

    expect(mockedSongUrl).toHaveBeenCalledWith(
      { cookie: '' },
      { ids: [186016, 347230], level: 'standard' },
    )
  })

  it('缺省音质档位回落 standard', async () => {
    mockedSongUrl.mockResolvedValue(sources)

    await GET(makeEvent('?ids=1'))

    expect(mockedSongUrl).toHaveBeenCalledWith({ cookie: '' }, { ids: [1], level: 'standard' })
  })

  it('非 standard 档位原样传递', async () => {
    mockedSongUrl.mockResolvedValue(sources)

    await GET(makeEvent('?ids=1&level=hires'))

    expect(mockedSongUrl).toHaveBeenCalledWith({ cookie: '' }, { ids: [1], level: 'hires' })
  })

  it('音质档位非法 → 400 INVALID_PARAMS 且不调用门面', async () => {
    const res = await GET(makeEvent('?ids=1&level=ultra'))

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'INVALID_PARAMS' } })
    expect(mockedSongUrl).not.toHaveBeenCalled()
  })

  it('缺少 ids → 400 INVALID_PARAMS', async () => {
    const res = await GET(makeEvent(''))

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'INVALID_PARAMS' } })
  })

  it('ids 非纯数字 → 400 INVALID_PARAMS', async () => {
    const res = await GET(makeEvent('?ids=abc'))

    expect(res.status).toBe(400)
    expect(mockedSongUrl).not.toHaveBeenCalled()
  })

  it('ids 数量超单请求上限 → 400 INVALID_PARAMS', async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => i + 1).join(',')
    const res = await GET(makeEvent(`?ids=${ids}`))

    expect(res.status).toBe(400)
    expect(mockedSongUrl).not.toHaveBeenCalled()
  })

  it('被限流 → 429 且带错误码', async () => {
    mockedSongUrl.mockRejectedValue(new NcmError('RATE_LIMITED', '请求过于频繁'))

    const res = await GET(makeEvent('?ids=1'))

    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } })
  })

  it('门面抛非领域异常 → 500 UNKNOWN', async () => {
    mockedSongUrl.mockRejectedValue(new Error('boom'))

    const res = await GET(makeEvent('?ids=1'))

    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: { code: 'UNKNOWN' } })
  })
})
