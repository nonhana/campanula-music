import type { RequestEvent } from '@sveltejs/kit'
import { clearBoundUser } from '$lib/server/binding'
import { NcmError } from '$lib/server/ncm/errors'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE } from './+server'

vi.mock('$lib/server/binding', () => ({
  clearBoundUser: vi.fn(),
}))

const mockedClear = vi.mocked(clearBoundUser)

function makeEvent(): RequestEvent {
  return { url: new URL('http://localhost/api/binding'), request: new Request('http://localhost/api/binding', { method: 'DELETE' }) } as RequestEvent
}

beforeEach(() => {
  mockedClear.mockReset()
})

describe('dELETE /api/binding', () => {
  it('解绑成功 → 200 unbound', async () => {
    mockedClear.mockResolvedValue()

    const res = await DELETE(makeEvent())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'unbound' })
    expect(mockedClear).toHaveBeenCalledTimes(1)
  })

  it('凭据文件不存在时幂等成功（unbound 语义）', async () => {
    mockedClear.mockResolvedValue()

    const res = await DELETE(makeEvent())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'unbound' })
  })

  it('删除失败映射为领域错误', async () => {
    mockedClear.mockRejectedValue(new NcmError('UNKNOWN', '磁盘不可写'))

    const res = await DELETE(makeEvent())

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: { code: 'UNKNOWN', message: '磁盘不可写' } })
  })
})
