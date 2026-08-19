import {
  loginQrCheck as sdkLoginQrCheck,
  loginQrCreate as sdkLoginQrCreate,
  loginQrKey as sdkLoginQrKey,
  userAccount as sdkUserAccount,
} from 'hana-music-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mapAccountBody, mapQrCheckBody, mapQrCreateBody, mapQrKeyBody, ncmCheckAuth, ncmLoginQrCheck, ncmLoginQrCreate, ncmLoginQrKey } from './auth'

vi.mock('hana-music-api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('hana-music-api')>()
  return { ...mod, userAccount: vi.fn(), loginQrKey: vi.fn(), loginQrCreate: vi.fn(), loginQrCheck: vi.fn() }
})

const mockedUserAccount = vi.mocked(sdkUserAccount)
const mockedQrKey = vi.mocked(sdkLoginQrKey)
const mockedQrCreate = vi.mocked(sdkLoginQrCreate)
const mockedQrCheck = vi.mocked(sdkLoginQrCheck)

beforeEach(() => {
  mockedUserAccount.mockReset()
  mockedQrKey.mockReset()
  mockedQrCreate.mockReset()
  mockedQrCheck.mockReset()
})

describe('mapAccountBody', () => {
  it('提取账号 id 与昵称', () => {
    expect(mapAccountBody({ code: 200, account: { id: 98765 }, profile: { nickname: '风铃草' } }))
      .toEqual({ userId: 98765, nickname: '风铃草' })
  })

  it('字段缺失或类型不符回落安全空值', () => {
    expect(mapAccountBody({ code: 200 })).toEqual({ userId: 0, nickname: '' })
    expect(mapAccountBody({ account: { id: 'x' }, profile: null })).toEqual({ userId: 0, nickname: '' })
  })
})

describe('ncmCheckAuth', () => {
  it('携带绑定凭据调用账号校验并返回账号信息', async () => {
    mockedUserAccount.mockResolvedValue({
      status: 200,
      body: { code: 200, account: { id: 98765 }, profile: { nickname: '风铃草' } },
      cookie: [],
    } as never)

    const info = await ncmCheckAuth({ cookie: 'MUSIC_U=abc' })

    expect(mockedUserAccount).toHaveBeenCalledWith({}, { cookie: 'MUSIC_U=abc' })
    expect(info).toEqual({ userId: 98765, nickname: '风铃草' })
  })

  it('无绑定凭据时不传 cookie', async () => {
    mockedUserAccount.mockResolvedValue({ status: 200, body: { code: 301 }, cookie: [] } as never)

    await expect(ncmCheckAuth({ cookie: '' })).rejects.toMatchObject({ name: 'NcmError', code: 'UNAUTHENTICATED' })
    expect(mockedUserAccount).toHaveBeenCalledWith({}, undefined)
  })

  it('「HTTP 200 + 业务码 301」形态映射为绑定失效', async () => {
    mockedUserAccount.mockResolvedValue({ status: 200, body: { code: 301, msg: '需要登录' }, cookie: [] } as never)

    await expect(ncmCheckAuth({ cookie: 'MUSIC_U=expired' })).rejects.toMatchObject(
      { name: 'NcmError', code: 'UNAUTHENTICATED' },
    )
  })

  it('「HTTP 200 + 空 account」形态（无效凭据/匿名身份）映射为绑定失效', async () => {
    mockedUserAccount.mockResolvedValue({ status: 200, body: { code: 200, account: null, profile: null }, cookie: [] } as never)

    await expect(ncmCheckAuth({ cookie: 'MUSIC_U=fake' })).rejects.toMatchObject(
      { name: 'NcmError', code: 'UNAUTHENTICATED' },
    )

    mockedUserAccount.mockResolvedValue({ status: 200, body: { code: 200 }, cookie: [] } as never)

    await expect(ncmCheckAuth({ cookie: 'MUSIC_U=fake' })).rejects.toMatchObject(
      { name: 'NcmError', code: 'UNAUTHENTICATED' },
    )
  })

  it('sDK 失败映射为领域错误（限流/绑定失效）', async () => {
    mockedUserAccount.mockRejectedValue({ status: 429, body: { code: -460, msg: '操作太频繁' } })

    await expect(ncmCheckAuth({ cookie: '' })).rejects.toMatchObject(
      { name: 'NcmError', code: 'RATE_LIMITED' },
    )

    mockedUserAccount.mockRejectedValue({ status: 301, body: { code: -462 } })

    await expect(ncmCheckAuth({ cookie: '' })).rejects.toMatchObject(
      { name: 'NcmError', code: 'UNAUTHENTICATED' },
    )
  })
})

describe('mapQrKeyBody', () => {
  it('提取 unikey 作为二维码 key', () => {
    expect(mapQrKeyBody({ code: 200, data: { unikey: 'abc123' } })).toEqual({ key: 'abc123', unikey: 'abc123' })
  })

  it('数据缺失回落安全空值', () => {
    expect(mapQrKeyBody({ code: 200 })).toEqual({ key: '', unikey: '' })
  })
})

describe('ncmLoginQrKey', () => {
  it('调用 SDK 获取二维码 key', async () => {
    mockedQrKey.mockResolvedValue({ status: 200, body: { code: 200, data: { unikey: 'abc123' } }, cookie: [] } as never)

    await expect(ncmLoginQrKey()).resolves.toEqual({ key: 'abc123', unikey: 'abc123' })
    expect(mockedQrKey).toHaveBeenCalledWith({})
  })

  it('sDK 失败映射为领域错误', async () => {
    mockedQrKey.mockRejectedValue({ status: 429, body: { code: -460, msg: '操作太频繁' } })

    await expect(ncmLoginQrKey()).rejects.toMatchObject({ name: 'NcmError', code: 'RATE_LIMITED' })
  })
})

describe('mapQrCreateBody', () => {
  it('提取二维码内容与图片（data URL）', () => {
    const body = {
      code: 200,
      data: { qrurl: 'https://music.163.com/login?codekey=abc', qrimg: 'data:image/png;base64,xxx' },
    }
    expect(mapQrCreateBody(body)).toEqual({
      qrUrl: 'https://music.163.com/login?codekey=abc',
      qrimg: 'data:image/png;base64,xxx',
    })
  })

  it('数据缺失回落安全空值', () => {
    expect(mapQrCreateBody({ code: 200 })).toEqual({ qrUrl: '', qrimg: '' })
  })
})

describe('ncmLoginQrCreate', () => {
  it('以 key 请求二维码并索取 qrimg 图片', async () => {
    mockedQrCreate.mockResolvedValue({
      status: 200,
      body: { code: 200, data: { qrurl: 'https://music.163.com/login?codekey=abc', qrimg: 'data:image/png;base64,xxx' } },
      cookie: [],
    } as never)

    await expect(ncmLoginQrCreate('abc')).resolves.toEqual({
      qrUrl: 'https://music.163.com/login?codekey=abc',
      qrimg: 'data:image/png;base64,xxx',
    })
    expect(mockedQrCreate).toHaveBeenCalledWith({ key: 'abc', qrimg: true })
  })

  it('sDK 失败映射为领域错误', async () => {
    mockedQrCreate.mockRejectedValue({ status: 500, body: { code: 500, msg: '服务器开小差了' } })

    await expect(ncmLoginQrCreate('abc')).rejects.toMatchObject({ name: 'NcmError', code: 'UNKNOWN' })
  })
})

describe('mapQrCheckBody', () => {
  it('code 801 → waiting', () => {
    expect(mapQrCheckBody({ code: 801 })).toEqual({ status: 'waiting' })
  })

  it('code 802 → scanned', () => {
    expect(mapQrCheckBody({ code: 802 })).toEqual({ status: 'scanned' })
  })

  it('code 803 → confirmed 且携带上游回传凭据', () => {
    expect(mapQrCheckBody({ code: 803, cookie: 'MUSIC_U=abc' })).toEqual({ status: 'confirmed', cookie: 'MUSIC_U=abc' })
  })

  it('code 803 无凭据 → confirmed 且 cookie 缺省', () => {
    expect(mapQrCheckBody({ code: 803 })).toEqual({ status: 'confirmed', cookie: undefined })
  })

  it('code 800 → expired', () => {
    expect(mapQrCheckBody({ code: 800, message: '二维码已过期' })).toEqual({ status: 'expired' })
  })

  it('未知/缺失 code → null（由调用方判为错误）', () => {
    expect(mapQrCheckBody({ code: -1 })).toBeNull()
    expect(mapQrCheckBody({})).toBeNull()
    expect(mapQrCheckBody(null)).toBeNull()
  })
})

describe('ncmLoginQrCheck', () => {
  it('按 key 轮询并映射扫码状态', async () => {
    mockedQrCheck.mockResolvedValue({ status: 200, body: { code: 801 }, cookie: [] } as never)

    await expect(ncmLoginQrCheck('abc')).resolves.toEqual({ status: 'waiting' })
    expect(mockedQrCheck).toHaveBeenCalledWith({ key: 'abc' })
  })

  it('确认态透传凭据', async () => {
    mockedQrCheck.mockResolvedValue({ status: 200, body: { code: 803, cookie: 'MUSIC_U=abc' }, cookie: [] } as never)

    await expect(ncmLoginQrCheck('abc')).resolves.toEqual({ status: 'confirmed', cookie: 'MUSIC_U=abc' })
  })

  it('上游未返回可识别状态 → 按 UNKNOWN 抛错（避免静默死轮询）', async () => {
    mockedQrCheck.mockResolvedValue({ status: 200, body: {}, cookie: [] } as never)

    await expect(ncmLoginQrCheck('abc')).rejects.toMatchObject({ name: 'NcmError', code: 'UNKNOWN' })
  })

  it('sDK 失败映射为领域错误', async () => {
    mockedQrCheck.mockRejectedValue({ status: 429, body: { code: -460, msg: '操作太频繁' } })

    await expect(ncmLoginQrCheck('abc')).rejects.toMatchObject({ name: 'NcmError', code: 'RATE_LIMITED' })
  })
})
