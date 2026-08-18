import type { RequestEvent } from '@sveltejs/kit'
import { resolveBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { ncmLike } from '$lib/server/ncm/like'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './+server'

vi.mock('$lib/server/binding', () => ({
  resolveBoundUser: vi.fn(),
}))

vi.mock('$lib/server/ncm/like', () => ({
  ncmLike: vi.fn(),
}))

const mockedBound = vi.mocked(resolveBoundUser)
const mockedLike = vi.mocked(ncmLike)

function makeEvent(body: unknown): RequestEvent {
  return {
    request: new Request('http://localhost/api/songs/like', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as RequestEvent
}

beforeEach(() => {
  mockedBound.mockReset()
  mockedLike.mockReset()
})

describe('pOST /api/songs/like', () => {
  it('未绑定时返回 401 UNAUTHENTICATED 引导文案，不调用门面', async () => {
    mockedBound.mockResolvedValue(null)

    const res = await POST(makeEvent({ id: 186016, like: true }))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
    expect(mockedLike).not.toHaveBeenCalled()
  })

  it('已绑定时以绑定凭据与红心状态写回账号', async () => {
    mockedBound.mockResolvedValue({ uid: 98765, cookie: 'MUSIC_U=abc' })
    mockedLike.mockResolvedValue()

    const res = await POST(makeEvent({ id: 186016, like: true }))

    expect(mockedLike).toHaveBeenCalledWith({ cookie: 'MUSIC_U=abc' }, { id: 186016, like: true })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('取消红心原样传递', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })
    mockedLike.mockResolvedValue()

    await POST(makeEvent({ id: 6452, like: false }))

    expect(mockedLike).toHaveBeenCalledWith({ cookie: '' }, { id: 6452, like: false })
  })

  it('id 缺失或非法 → 400 INVALID_PARAMS 且不调用门面', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })

    for (const body of [{ like: true }, { id: '186016', like: true }, { id: 1.5, like: true }, { id: 0, like: true }, { id: -1, like: true }]) {
      const res = await POST(makeEvent(body))
      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toMatchObject({ error: { code: 'INVALID_PARAMS' } })
    }
    expect(mockedLike).not.toHaveBeenCalled()
  })

  it('like 缺失或非法 → 400 INVALID_PARAMS', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })

    for (const body of [{ id: 1 }, { id: 1, like: 'true' }, { id: 1, like: 1 }]) {
      const res = await POST(makeEvent(body))
      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toMatchObject({ error: { code: 'INVALID_PARAMS' } })
    }
    expect(mockedLike).not.toHaveBeenCalled()
  })

  it('门面被限流 → 429 且带错误码', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })
    mockedLike.mockRejectedValue(new NcmError('RATE_LIMITED', '请求过于频繁，请稍后再试', { status: 429 }))

    const res = await POST(makeEvent({ id: 1, like: true }))

    expect(res.status).toBe(429)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'RATE_LIMITED' } })
  })

  it('门面抛非领域异常 → 500 UNKNOWN', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })
    mockedLike.mockRejectedValue(new Error('boom'))

    const res = await POST(makeEvent({ id: 1, like: true }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNKNOWN' } })
  })

  it('「HTTP 200 + 业务失败码」形态的领域错误 → 按错误码回落错误状态', async () => {
    mockedBound.mockResolvedValue({ uid: 1, cookie: '' })
    mockedLike.mockRejectedValue(new NcmError('UNAUTHENTICATED', '登录状态已失效，请重新绑定', { status: 200 }))

    const res = await POST(makeEvent({ id: 1, like: true }))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'UNAUTHENTICATED', message: '登录状态已失效，请重新绑定' },
    })
  })
})
