import type { LyricItem } from '$lib/types'
import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmLyric } from '$lib/server/ncm/lyric'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

vi.mock('$lib/server/binding', () => ({
  resolveBoundUser: vi.fn(),
}))

vi.mock('$lib/server/ncm/lyric', () => ({
  ncmLyric: vi.fn(),
}))

const mockedBound = vi.mocked(resolveBoundUser)
const mockedLyric = vi.mocked(ncmLyric)

function makeEvent(query = ''): RequestEvent {
  return { url: new URL(`http://localhost/api/songs/lyric${query}`) } as RequestEvent
}

const lyrics: LyricItem[] = [
  { time: 1000, text: '第一句', translate: null },
  { time: 3500, text: '第二句', translate: 'Second line' },
]

beforeEach(() => {
  mockedBound.mockReset()
  mockedLyric.mockReset()
  mockedBound.mockResolvedValue(null)
})

describe('gET /api/songs/lyric', () => {
  it('id 参数转发给门面并回传歌词列表；未绑定时传空凭据', async () => {
    mockedLyric.mockResolvedValue(lyrics)

    const res = await GET(makeEvent('?id=186016'))

    expect(mockedLyric).toHaveBeenCalledWith({ cookie: '' }, 186016)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(lyrics)
  })

  it('已绑定时携带绑定凭据', async () => {
    mockedBound.mockResolvedValue({ uid: 98765, cookie: 'MUSIC_U=abc' })
    mockedLyric.mockResolvedValue(lyrics)

    await GET(makeEvent('?id=186016'))

    expect(mockedLyric).toHaveBeenCalledWith({ cookie: 'MUSIC_U=abc' }, 186016)
  })

  it('无歌词返回空数组（如实呈现，非错误）', async () => {
    mockedLyric.mockResolvedValue([])

    const res = await GET(makeEvent('?id=186016'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('缺少 id → 400 INVALID_PARAMS', async () => {
    const res = await GET(makeEvent(''))

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'INVALID_PARAMS' } })
    expect(mockedLyric).not.toHaveBeenCalled()
  })

  it('id 非纯数字 → 400 INVALID_PARAMS 且不调用门面', async () => {
    const res = await GET(makeEvent('?id=abc'))

    expect(res.status).toBe(400)
    expect(mockedLyric).not.toHaveBeenCalled()
  })

  it('无版权 → 404 且带错误码', async () => {
    mockedLyric.mockRejectedValue(new NcmError('RESOURCE_UNAVAILABLE', '亲爱的,暂无版权'))

    const res = await GET(makeEvent('?id=6452'))

    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: { code: 'RESOURCE_UNAVAILABLE' } })
  })

  it('门面抛非领域异常 → 500 UNKNOWN', async () => {
    mockedLyric.mockRejectedValue(new Error('boom'))

    const res = await GET(makeEvent('?id=1'))

    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: { code: 'UNKNOWN' } })
  })
})
