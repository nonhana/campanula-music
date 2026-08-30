import type { NcmBindingStatus, NcmQrStatus } from '$lib/types'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { ncmCheckAuth, ncmLoginQrCheck, ncmLoginQrCreate, ncmLoginQrKey } from './ncm/auth'
import { NcmError } from './ncm/errors'

/**
 * 绑定凭据层与绑定编排。
 *
 * 凭据（扫码所得 cookie + uid）持久化在本地数据目录中的独立凭据文件，
 * 与任何数据库解耦，重启不丢失；`USER_COOKIE` 环境变量逃生通道已废弃，
 * cookie 只有绑定文件一个来源。数据目录默认 `.data`（进程工作目录下，
 * 已入忽略列表），可用 DATA_DIR 环境变量覆盖（Docker 卷挂载场景）。
 *
 * 二维码会话纪元：startQrBinding 成功时把本次 key 持久化到数据目录的
 * qr-session.json（0600）；pollQrBinding 只承认与该会话一致的 key——
 * 会话文件缺失（含解绑后的删除）或 key 不一致均按「二维码已过期」拒绝且
 * 不写凭据，防止解绑后仍在途的旧轮询把实例重新绑回旧账号。
 *
 * 心跳：resolveBindingStatus 调用账号校验接口判定绑定状态——UNAUTHENTICATED
 * 即绑定失效（凭据文件保留以区分「尚未绑定」与「绑定失效」两态，引导页分别呈现）；
 * 瞬时错误（限流/网络等）不误判失效，宁可乐观放行，真实失败由各业务接口如实兜底。
 * 不做自动保活：网易云无可靠刷新机制，频繁重登触发风控（见 Spec）。
 */

/** 绑定账号凭据：扫码绑定所得，凭据文件的唯一内容 */
export interface BoundUser {
  /** 绑定账号的网易云用户 id */
  uid: number
  /** 绑定所得 cookie（全部网易云接口的账号许可） */
  cookie: string
}

/** 绑定状态（共享领域类型，见 $lib/types/ncm） */
export type BindingStatus = NcmBindingStatus

/** 二维码绑定启动结果 */
export interface QrBindingStart {
  key: string
  qrUrl: string
  qrimg: string
}

/** 扫码轮询结果（确认态凭据只在编排内部流转，不外泄；状态类型见 $lib/types/ncm） */
export interface QrBindingCheck { status: NcmQrStatus }

const CREDENTIAL_FILE = 'credential.json'
const QR_SESSION_FILE = 'qr-session.json'

/** 本地数据目录：默认进程工作目录下 `.data`，DATA_DIR 可覆盖（Docker 卷挂载） */
function dataDir(): string {
  return process.env.DATA_DIR?.trim() || '.data'
}

function credentialFile(): string {
  return path.join(dataDir(), CREDENTIAL_FILE)
}

function qrSessionFile(): string {
  return path.join(dataDir(), QR_SESSION_FILE)
}

/**
 * 读取当前二维码会话的 key。文件缺失或内容损坏均视为无有效会话
 * （安全侧默认：后续轮询一律拒绝写凭据，重新扫码即可自愈）。
 */
async function readQrSessionKey(): Promise<string | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(qrSessionFile(), 'utf-8'))
    if (typeof parsed !== 'object' || parsed === null || !('key' in parsed))
      return null
    const { key } = parsed
    return typeof key === 'string' ? key : null
  }
  catch {
    return null
  }
}

function isBoundUser(value: unknown): value is BoundUser {
  if (typeof value !== 'object' || value === null)
    return false
  const record = value as Record<string, unknown>
  return typeof record.uid === 'number' && Number.isInteger(record.uid) && record.uid > 0
    && typeof record.cookie === 'string' && record.cookie.length > 0
}

/**
 * 解析绑定凭据：读取凭据文件。文件缺失或内容损坏均视为未绑定
 * （用户重新扫码即可自愈），读取失败同样按未绑定处理。
 */
export async function resolveBoundUser(): Promise<BoundUser | null> {
  try {
    const raw = await readFile(credentialFile(), 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    return isBoundUser(parsed) ? parsed : null
  }
  catch {
    return null
  }
}

/**
 * 写入绑定凭据：目录自动创建，先写临时文件再原子改名，避免半写损坏。
 * 临时名带时间戳 + 随机后缀：并发扫码确认各写各的临时文件，不会互踩出损坏文件。
 */
export async function saveBoundUser(user: BoundUser): Promise<void> {
  const file = credentialFile()
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${Date.now()}-${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(user), { mode: 0o600 })
  await rename(tmp, file)
}

/**
 * 删除绑定凭据（解绑）：文件不存在时幂等返回，应用回到未绑定态。
 * 同时删除二维码会话文件——解绑即作废在途 key，旧轮询无法再写凭据。
 */
export async function clearBoundUser(): Promise<void> {
  for (const file of [credentialFile(), qrSessionFile()]) {
    try {
      await rm(file)
    }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT')
        throw err
    }
  }
}

/**
 * 绑定心跳：冷启动与低频周期复检的判定入口。
 * - 无凭据文件 → 尚未绑定
 * - 账号校验 UNAUTHENTICATED → 绑定失效
 * - 校验通过 → 绑定有效（附账号信息）
 * - 瞬时错误（限流/网络等）→ 乐观放行（nickname 未知置空），不误踢用户
 */
export async function resolveBindingStatus(): Promise<BindingStatus> {
  const user = await resolveBoundUser()
  if (!user)
    return { status: 'unbound' }
  try {
    const account = await ncmCheckAuth({ cookie: user.cookie })
    return { status: 'valid', user: { uid: account.userId, nickname: account.nickname } }
  }
  catch (err) {
    if (err instanceof NcmError && err.code === 'UNAUTHENTICATED')
      return { status: 'invalid' }
    return { status: 'valid', user: { uid: user.uid, nickname: '' } }
  }
}

/**
 * 二维码绑定第一步：获取 key 并生成二维码内容与图片。
 * 成功后把本次 key 持久化为当前会话（0600），后续轮询凭此校验纪元。
 */
export async function startQrBinding(): Promise<QrBindingStart> {
  const { key } = await ncmLoginQrKey()
  const qr = await ncmLoginQrCreate(key)
  const file = qrSessionFile()
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify({ key }), { mode: 0o600 })
  return { key, qrUrl: qr.qrUrl, qrimg: qr.qrimg }
}

/**
 * 二维码绑定第二步：轮询扫码状态；确认（扫码成功）时校验账号并写入凭据。
 * 请求 key 必须与当前会话一致：会话文件缺失或 key 不一致（含解绑后仍在途的
 * 旧轮询）均按「二维码已过期」抛错，不触发上游轮询更不写凭据。
 * 确认但未取回凭据 / 账号校验失败均抛 NcmError，不写凭据（用户重扫自愈）。
 */
export async function pollQrBinding(key: string): Promise<QrBindingCheck> {
  if ((await readQrSessionKey()) !== key)
    throw new NcmError('RESOURCE_UNAVAILABLE', '二维码已过期，请重新扫码')
  const check = await ncmLoginQrCheck(key)
  if (check.status !== 'confirmed')
    return { status: check.status }
  const cookie = check.cookie
  if (!cookie)
    throw new NcmError('UNKNOWN', '扫码成功但未取回账号凭据，请重试')
  const account = await ncmCheckAuth({ cookie })
  await saveBoundUser({ uid: account.userId, cookie })
  return { status: 'confirmed' }
}
