import type { QrBindingCheck } from '$lib/server/binding'
import type { RequestEvent } from '@sveltejs/kit'
import { pollQrBinding } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

vi.mock('$lib/server/binding', () => ({
  pollQrBinding: vi.fn(),
}))

const mockedPoll = vi.mocked(pollQrBinding)

function makeEvent(key = ''): RequestEvent {
  return { url: new URL(`http://localhost/api/binding/qr/status${key ? `?key=${key}` : ''}`) } as RequestEvent
}

beforeEach(() => {
  mockedPoll.mockReset()
})

describe('gET /api/binding/qr/status', () => {
  it('缺少 key → 400 INVALID_PARAMS，不轮询', async () => {
    const res = await GET(makeEvent())

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'INVALID_PARAMS' } })
    expect(mockedPoll).not.toHaveBeenCalled()
  })

  it.each<QrBindingCheck>([
    { status: 'waiting' },
    { status: 'scanned' },
    { status: 'expired' },
  ])('轮询到 %s → 透传状态', async (state) => {
    mockedPoll.mockResolvedValue(state)

    const res = await GET(makeEvent('abc123'))

    expect(mockedPoll).toHaveBeenCalledWith('abc123')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(state)
  })

  it('确认（扫码成功并已写入凭据）→ confirmed', async () => {
    mockedPoll.mockResolvedValue({ status: 'confirmed' })

    const res = await GET(makeEvent('abc123'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'confirmed' })
  })

  it('轮询失败（绑定失效）→ 401 且带错误码', async () => {
    mockedPoll.mockRejectedValue(new NcmError('UNAUTHENTICATED', '绑定已失效，需要重新扫码'))

    const res = await GET(makeEvent('abc123'))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
  })
})
