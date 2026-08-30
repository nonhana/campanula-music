import { describe, expect, it } from 'vitest'
import { mapNcmError, NcmError } from './errors'

describe('ncmError', () => {
  it('携带领域错误码与可选状态码', () => {
    const err = new NcmError('UNAUTHENTICATED', '绑定已失效', { status: 301 })
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('UNAUTHENTICATED')
    expect(err.message).toBe('绑定已失效')
    expect(err.status).toBe(301)
    expect(err.name).toBe('NcmError')
  })

  it('透传 cause', () => {
    const cause = new Error('upstream')
    const err = new NcmError('UNKNOWN', 'x', { cause })
    expect(err.cause).toBe(cause)
  })
})

describe('mapNcmError', () => {
  it('对已是 NcmError 的输入原样返回', () => {
    const err = new NcmError('RATE_LIMITED', '慢点')
    expect(mapNcmError(err)).toBe(err)
  })

  it('301 响应 → 绑定失效', () => {
    const mapped = mapNcmError({ body: { code: 200, msg: 'ok' }, cookie: [], status: 301 })
    expect(mapped.code).toBe('UNAUTHENTICATED')
    expect(mapped.status).toBe(301)
  })
  it('业务码 -462（登录状态失效）→ 绑定失效', () => {
    const mapped = mapNcmError({ body: { code: -462, msg: '' }, cookie: [], status: 200 })
    expect(mapped.code).toBe('UNAUTHENTICATED')
  })
  it('业务码 301（需要登录，账号校验接口典型应答）→ 绑定失效', () => {
    const mapped = mapNcmError({ body: { code: 301, msg: '需要登录' }, cookie: [], status: 200 })
    expect(mapped.code).toBe('UNAUTHENTICATED')
  })

  it('消息含"需要登录" → 绑定失效', () => {
    const mapped = mapNcmError({ body: { code: 200, msg: '需要登录' }, cookie: [], status: 200 })
    expect(mapped.code).toBe('UNAUTHENTICATED')
  })

  it('hTTP 429 → 被限流', () => {
    const mapped = mapNcmError({ body: { code: 200, msg: 'ok' }, cookie: [], status: 429 })
    expect(mapped.code).toBe('RATE_LIMITED')
  })

  it('业务码 -460（操作频繁）→ 被限流', () => {
    const mapped = mapNcmError({ body: { code: -460, msg: '' }, cookie: [], status: 200 })
    expect(mapped.code).toBe('RATE_LIMITED')
  })

  it('业务码 -110（无版权）→ 资源不可用', () => {
    const mapped = mapNcmError({ body: { code: -110, msg: '' }, cookie: [], status: 200 })
    expect(mapped.code).toBe('RESOURCE_UNAVAILABLE')
  })

  it('消息含"无版权" → 资源不可用', () => {
    const mapped = mapNcmError({ body: { code: 200, msg: '亲爱的,暂无版权' }, cookie: [], status: 200 })
    expect(mapped.code).toBe('RESOURCE_UNAVAILABLE')
  })

  it('sDK 传输层超时 → 资源不可用且文案中文化（避免英文超时直出）', () => {
    // 失败封套按 SDK 传输层超时形状（client.generated.js）构造：code/status 504 + 固定英文文案
    const mapped = mapNcmError({ body: { code: 504, msg: 'Request timed out after 10000ms' }, cookie: [], status: 504 })
    expect(mapped.code).toBe('RESOURCE_UNAVAILABLE')
    expect(mapped.message).toBe('上游请求超时，请稍后重试')
    expect(mapped.status).toBe(504)
  })

  it('无 msg 的 SDK 失败 → 消息回退业务码字符串，不出现 [object Object]', () => {
    const mapped = mapNcmError({ body: { code: 400 }, cookie: [], status: 200 })
    expect(mapped.code).toBe('UNKNOWN')
    expect(mapped.message).toBe('400')
  })

  it('无 msg 且无业务码的 SDK 失败 → 中文兜底文案', () => {
    const mapped = mapNcmError({ body: {}, cookie: [], status: 200 })
    expect(mapped.message).toBe('未知上游错误')
  })

  it('无法识别的 SDK 失败 → UNKNOWN 且保留消息与状态码', () => {
    const mapped = mapNcmError({ body: { code: 500, msg: '内部错误' }, cookie: [], status: 502 })
    expect(mapped.code).toBe('UNKNOWN')
    expect(mapped.message).toBe('内部错误')
    expect(mapped.status).toBe(502)
  })

  it('普通 Error → UNKNOWN 且保留 message', () => {
    const mapped = mapNcmError(new Error('fetch failed'))
    expect(mapped.code).toBe('UNKNOWN')
    expect(mapped.message).toBe('fetch failed')
    expect(mapped.status).toBeUndefined()
  })

  it('非错误输入 → UNKNOWN 兜底', () => {
    const mapped = mapNcmError('weird')
    expect(mapped.code).toBe('UNKNOWN')
    expect(mapped.message).toBe('未知上游错误')
  })
})
