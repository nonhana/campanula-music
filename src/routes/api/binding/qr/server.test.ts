import type { RequestEvent } from '@sveltejs/kit'
import { startQrBinding } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

vi.mock('$lib/server/binding', () => ({
  startQrBinding: vi.fn(),
}))

const mockedStart = vi.mocked(startQrBinding)

function makeEvent(): RequestEvent {
  return { url: new URL('http://localhost/api/binding/qr') } as RequestEvent
}

beforeEach(() => {
  mockedStart.mockReset()
})

describe('gET /api/binding/qr', () => {
  it('返回二维码 key 与图片（data URL）', async () => {
    mockedStart.mockResolvedValue({
      key: 'abc123',
      qrUrl: 'https://music.163.com/login?codekey=abc123',
      qrimg: 'data:image/png;base64,xxx',
    })

    const res = await GET(makeEvent())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      key: 'abc123',
      qrUrl: 'https://music.163.com/login?codekey=abc123',
      qrimg: 'data:image/png;base64,xxx',
    })
  })

  it('获取二维码失败（限流）→ 429 且带错误码', async () => {
    mockedStart.mockRejectedValue(new NcmError('RATE_LIMITED', '请求过于频繁，请稍后再试', { status: 429 }))

    const res = await GET(makeEvent())

    expect(res.status).toBe(429)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'RATE_LIMITED' } })
  })
})
