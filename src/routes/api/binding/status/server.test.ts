import type { RequestEvent } from '@sveltejs/kit'
import { resolveBindingStatus } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

vi.mock('$lib/server/binding', () => ({
  resolveBindingStatus: vi.fn(),
}))

const mockedStatus = vi.mocked(resolveBindingStatus)

function makeEvent(): RequestEvent {
  return { url: new URL('http://localhost/api/binding/status') } as RequestEvent
}

beforeEach(() => {
  mockedStatus.mockReset()
})

describe('gET /api/binding/status', () => {
  it('尚未绑定 → 200 unbound（引导页进入首次绑定态）', async () => {
    mockedStatus.mockResolvedValue({ status: 'unbound' })

    const res = await GET(makeEvent())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'unbound' })
  })

  it('绑定失效 → 200 invalid（引导页进入失效重绑态）', async () => {
    mockedStatus.mockResolvedValue({ status: 'invalid' })

    const res = await GET(makeEvent())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'invalid' })
  })

  it('绑定有效 → 200 valid 且带账号信息（不含 cookie）', async () => {
    mockedStatus.mockResolvedValue({ status: 'valid', user: { uid: 98765, nickname: '风铃草' } })

    const res = await GET(makeEvent())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'valid', user: { uid: 98765, nickname: '风铃草' } })
  })

  it('心跳校验失败（非领域异常）→ 500 UNKNOWN', async () => {
    mockedStatus.mockRejectedValue(new NcmError('UNKNOWN', 'boom'))

    const res = await GET(makeEvent())

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'UNKNOWN' } })
  })
})
