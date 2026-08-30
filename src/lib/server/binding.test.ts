import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearBoundUser, pollQrBinding, resolveBindingStatus, resolveBoundUser, saveBoundUser, startQrBinding } from './binding'
import { ncmCheckAuth, ncmLoginQrCheck, ncmLoginQrCreate, ncmLoginQrKey } from './ncm/auth'
import { NcmError } from './ncm/errors'

vi.mock('./ncm/auth', () => ({
  ncmCheckAuth: vi.fn(),
  ncmLoginQrKey: vi.fn(),
  ncmLoginQrCreate: vi.fn(),
  ncmLoginQrCheck: vi.fn(),
}))

const mockedCheckAuth = vi.mocked(ncmCheckAuth)
const mockedQrKey = vi.mocked(ncmLoginQrKey)
const mockedQrCreate = vi.mocked(ncmLoginQrCreate)
const mockedQrCheck = vi.mocked(ncmLoginQrCheck)

/** 通过 startQrBinding 播种当前二维码会话（真实写入 qr-session.json，key 随取随用） */
async function seedQrSession(key: string): Promise<void> {
  mockedQrKey.mockResolvedValue({ key, unikey: key })
  mockedQrCreate.mockResolvedValue({
    qrUrl: `https://music.163.com/login?codekey=${key}`,
    qrimg: 'data:image/png;base64,xxx',
  })
  await startQrBinding()
}

/** 每个用例用独立临时目录充当数据目录，避免相互污染 */
let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'campanula-binding-'))
  vi.stubEnv('DATA_DIR', tmpDir)
  vi.clearAllMocks()
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(tmpDir, { recursive: true, force: true })
})

describe('凭据文件读写', () => {
  it('无凭据文件 → 未绑定', async () => {
    await expect(resolveBoundUser()).resolves.toBeNull()
  })

  it('写入后原样读回（uid + cookie）', async () => {
    await saveBoundUser({ uid: 98765, cookie: 'MUSIC_U=abc' })

    await expect(resolveBoundUser()).resolves.toEqual({ uid: 98765, cookie: 'MUSIC_U=abc' })
  })

  it('数据目录不存在时自动创建（含多级路径）', async () => {
    const nested = path.join(tmpDir, 'a', 'b')
    vi.stubEnv('DATA_DIR', nested)

    await saveBoundUser({ uid: 1, cookie: 'MUSIC_U=x' })

    await expect(resolveBoundUser()).resolves.toEqual({ uid: 1, cookie: 'MUSIC_U=x' })
  })

  it('覆盖写入：重新绑定后读到新凭据', async () => {
    await saveBoundUser({ uid: 1, cookie: 'MUSIC_U=old' })
    await saveBoundUser({ uid: 2, cookie: 'MUSIC_U=new' })

    await expect(resolveBoundUser()).resolves.toEqual({ uid: 2, cookie: 'MUSIC_U=new' })
  })

  it('凭据文件损坏 → 按未绑定处理（可重新扫码自愈）', async () => {
    vi.stubEnv('DATA_DIR', tmpDir)
    await saveBoundUser({ uid: 1, cookie: 'MUSIC_U=x' })
    // 直接写坏文件内容
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path.join(tmpDir, 'credential.json'), '{not-json')

    await expect(resolveBoundUser()).resolves.toBeNull()
  })

  it('凭据形状非法（uid 非正整数 / cookie 缺失）→ 未绑定', async () => {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path.join(tmpDir, 'credential.json'), JSON.stringify({ uid: 'x', cookie: 'MUSIC_U=x' }))
    await expect(resolveBoundUser()).resolves.toBeNull()

    await writeFile(path.join(tmpDir, 'credential.json'), JSON.stringify({ uid: 1 }))
    await expect(resolveBoundUser()).resolves.toBeNull()
  })

  it('并发写入不互踩：全部成功、最终内容完整且为其中一次写入、无临时文件残留', async () => {
    const users = Array.from({ length: 20 }, (_, i) => ({ uid: i + 1, cookie: `MUSIC_U=u${i}` }))

    await expect(Promise.all(users.map(user => saveBoundUser(user)))).resolves.toHaveLength(20)
    await expect(resolveBoundUser()).resolves.toSatisfy((saved: unknown) =>
      users.some(user => JSON.stringify(user) === JSON.stringify(saved)),
    )
    const leftovers = (await readdir(tmpDir)).filter(file => file.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })
})

describe('resolveBindingStatus（心跳判定）', () => {
  it('无凭据文件 → 尚未绑定', async () => {
    await expect(resolveBindingStatus()).resolves.toEqual({ status: 'unbound' })
  })

  it('账号校验通过 → 绑定有效且带账号信息', async () => {
    await saveBoundUser({ uid: 98765, cookie: 'MUSIC_U=abc' })
    mockedCheckAuth.mockResolvedValue({ userId: 98765, nickname: '风铃草' })

    await expect(resolveBindingStatus()).resolves.toEqual({
      status: 'valid',
      user: { uid: 98765, nickname: '风铃草' },
    })
    expect(mockedCheckAuth).toHaveBeenCalledWith({ cookie: 'MUSIC_U=abc' })
  })

  it('账号校验 UNAUTHENTICATED → 绑定失效（凭据文件保留，区分首次与失效两态）', async () => {
    await saveBoundUser({ uid: 98765, cookie: 'MUSIC_U=expired' })
    mockedCheckAuth.mockRejectedValue(new NcmError('UNAUTHENTICATED', '需要登录'))

    await expect(resolveBindingStatus()).resolves.toEqual({ status: 'invalid' })
    // 凭据未被清空：失效态可被识别
    await expect(resolveBoundUser()).resolves.toEqual({ uid: 98765, cookie: 'MUSIC_U=expired' })
  })

  it('瞬时错误（限流/网络）不误判失效 → 乐观放行', async () => {
    await saveBoundUser({ uid: 98765, cookie: 'MUSIC_U=abc' })
    mockedCheckAuth.mockRejectedValue(new NcmError('RATE_LIMITED', '请求过于频繁'))

    await expect(resolveBindingStatus()).resolves.toEqual({
      status: 'valid',
      user: { uid: 98765, nickname: '' },
    })
  })
})

describe('startQrBinding', () => {
  it('获取 key 后生成二维码，返回 key 与二维码图片', async () => {
    mockedQrKey.mockResolvedValue({ key: 'abc123', unikey: 'abc123' })
    mockedQrCreate.mockResolvedValue({
      qrUrl: 'https://music.163.com/login?codekey=abc123',
      qrimg: 'data:image/png;base64,xxx',
    })

    await expect(startQrBinding()).resolves.toEqual({
      key: 'abc123',
      qrUrl: 'https://music.163.com/login?codekey=abc123',
      qrimg: 'data:image/png;base64,xxx',
    })
    expect(mockedQrCreate).toHaveBeenCalledWith('abc123')
  })

  it('key 获取失败 → 抛领域错误，不请求二维码', async () => {
    mockedQrKey.mockRejectedValue(new NcmError('RATE_LIMITED', '请求过于频繁'))

    await expect(startQrBinding()).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    expect(mockedQrCreate).not.toHaveBeenCalled()
  })
})

describe('pollQrBinding', () => {
  it('等待/已扫码/过期直接透传状态，不写凭据', async () => {
    await seedQrSession('k1')
    mockedQrCheck.mockResolvedValueOnce({ status: 'waiting' })
    mockedQrCheck.mockResolvedValueOnce({ status: 'scanned' })
    mockedQrCheck.mockResolvedValueOnce({ status: 'expired' })

    await expect(pollQrBinding('k1')).resolves.toEqual({ status: 'waiting' })
    await expect(pollQrBinding('k1')).resolves.toEqual({ status: 'scanned' })
    await expect(pollQrBinding('k1')).resolves.toEqual({ status: 'expired' })
    await expect(resolveBoundUser()).resolves.toBeNull()
  })

  it('确认态：校验账号后写入凭据（uid + cookie）并返回确认', async () => {
    await seedQrSession('k1')
    mockedQrCheck.mockResolvedValue({ status: 'confirmed', cookie: 'MUSIC_U=abc' })
    mockedCheckAuth.mockResolvedValue({ userId: 98765, nickname: '风铃草' })

    await expect(pollQrBinding('k1')).resolves.toEqual({ status: 'confirmed' })
    expect(mockedCheckAuth).toHaveBeenCalledWith({ cookie: 'MUSIC_U=abc' })
    await expect(resolveBoundUser()).resolves.toEqual({ uid: 98765, cookie: 'MUSIC_U=abc' })
  })

  it('确认态但凭据缺失 → 抛 UNKNOWN 且不写凭据', async () => {
    await seedQrSession('k1')
    mockedQrCheck.mockResolvedValue({ status: 'confirmed' })

    await expect(pollQrBinding('k1')).rejects.toMatchObject({ name: 'NcmError', code: 'UNKNOWN' })
    expect(mockedCheckAuth).not.toHaveBeenCalled()
    await expect(resolveBoundUser()).resolves.toBeNull()
  })

  it('确认后账号校验失败 → 抛领域错误且不写凭据（可重扫自愈）', async () => {
    await seedQrSession('k1')
    mockedQrCheck.mockResolvedValue({ status: 'confirmed', cookie: 'MUSIC_U=bad' })
    mockedCheckAuth.mockRejectedValue(new NcmError('UNAUTHENTICATED', '需要登录'))

    await expect(pollQrBinding('k1')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    await expect(resolveBoundUser()).resolves.toBeNull()
  })
})

describe('二维码会话纪元（qr-session.json）', () => {
  it('startQrBinding 成功后持久化会话 key（0600）', async () => {
    await seedQrSession('k1')

    const file = path.join(tmpDir, 'qr-session.json')
    const { mode } = await stat(file)
    expect(mode & 0o777).toBe(0o600)
    await expect(readFile(file, 'utf-8')).resolves.toBe(JSON.stringify({ key: 'k1' }))
  })

  it('会话文件缺失 → 视为无有效会话：拒绝轮询且不写凭据（不触上游）', async () => {
    mockedQrCheck.mockResolvedValue({ status: 'confirmed', cookie: 'MUSIC_U=abc' })

    await expect(pollQrBinding('k1')).rejects.toMatchObject({
      name: 'NcmError',
      code: 'RESOURCE_UNAVAILABLE',
      message: '二维码已过期，请重新扫码',
    })
    expect(mockedQrCheck).not.toHaveBeenCalled()
    await expect(resolveBoundUser()).resolves.toBeNull()
  })

  it('key 与当前会话不一致 → 按二维码已过期拒绝，不写凭据', async () => {
    await seedQrSession('k1')
    mockedQrCheck.mockResolvedValue({ status: 'confirmed', cookie: 'MUSIC_U=abc' })

    await expect(pollQrBinding('stale-key')).rejects.toMatchObject({ code: 'RESOURCE_UNAVAILABLE' })
    expect(mockedQrCheck).not.toHaveBeenCalled()
    await expect(resolveBoundUser()).resolves.toBeNull()
  })

  it('解绑后旧 key confirmed → 无效且不写凭据（在途轮询无法复活旧账号）', async () => {
    await seedQrSession('k1')
    await clearBoundUser()
    mockedQrCheck.mockResolvedValue({ status: 'confirmed', cookie: 'MUSIC_U=old' })

    await expect(pollQrBinding('k1')).rejects.toMatchObject({
      code: 'RESOURCE_UNAVAILABLE',
      message: '二维码已过期，请重新扫码',
    })
    expect(mockedQrCheck).not.toHaveBeenCalled()
    await expect(resolveBoundUser()).resolves.toBeNull()
  })

  it('解绑同时删除会话文件', async () => {
    await seedQrSession('k1')
    await saveBoundUser({ uid: 1, cookie: 'MUSIC_U=x' })
    await clearBoundUser()

    await expect(stat(path.join(tmpDir, 'qr-session.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(path.join(tmpDir, 'credential.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('会话文件损坏 → 视为无有效会话（安全侧默认）', async () => {
    await seedQrSession('k1')
    await writeFile(path.join(tmpDir, 'qr-session.json'), '{not-json')
    mockedQrCheck.mockResolvedValue({ status: 'confirmed', cookie: 'MUSIC_U=abc' })

    await expect(pollQrBinding('k1')).rejects.toMatchObject({ code: 'RESOURCE_UNAVAILABLE' })
    await expect(resolveBoundUser()).resolves.toBeNull()
  })
})
