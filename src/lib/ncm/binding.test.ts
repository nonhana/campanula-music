import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decideBindingAction, fetchBindingStatus, fetchQrStatus, startQrLogin } from './binding'

describe('decideBindingAction（心跳判定）', () => {
  it('尚未绑定 → 进入绑定页', () => {
    expect(decideBindingAction({ status: 'unbound' })).toBe('bind')
  })

  it('绑定失效 → 置位全局失效提示', () => {
    expect(decideBindingAction({ status: 'invalid' })).toBe('mark-invalid')
  })

  it('绑定有效 → 清除失效提示', () => {
    expect(decideBindingAction({ status: 'valid', user: { uid: 1, nickname: 'a' } })).toBe('clear')
  })
})

describe('绑定数据接口', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function okResponse(body: unknown): Response {
    return { ok: true, status: 200, json: async () => body } as unknown as Response
  }

  it('fetchBindingStatus 请求心跳接口并透传领域状态', async () => {
    fetchMock.mockResolvedValue(okResponse({ status: 'valid', user: { uid: 1, nickname: '风铃草' } }))

    await expect(fetchBindingStatus()).resolves.toEqual({ status: 'valid', user: { uid: 1, nickname: '风铃草' } })
    expect(fetchMock).toHaveBeenCalledWith('/api/binding/status', { signal: undefined })
  })

  it('startQrLogin 请求二维码接口', async () => {
    fetchMock.mockResolvedValue(okResponse({ key: 'k', qrUrl: 'u', qrimg: 'img' }))

    await expect(startQrLogin()).resolves.toEqual({ key: 'k', qrUrl: 'u', qrimg: 'img' })
    expect(fetchMock).toHaveBeenCalledWith('/api/binding/qr', { signal: undefined })
  })

  it('fetchQrStatus 携带 key（编码）与时间戳轮询（防缓存）', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    fetchMock.mockResolvedValue(okResponse({ status: 'waiting' }))

    await expect(fetchQrStatus('abc 123')).resolves.toEqual({ status: 'waiting' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/binding/qr/status?key=abc%20123&t=1700000000000',
      { signal: undefined },
    )
    vi.restoreAllMocks()
  })

  it('非 2xx 响应抛 NcmClientError（供页面按码呈现文案）', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'UNKNOWN', message: 'boom' } }),
    } as unknown as Response)

    await expect(fetchBindingStatus()).rejects.toMatchObject({ name: 'NcmClientError', code: 'UNKNOWN' })
  })
})
