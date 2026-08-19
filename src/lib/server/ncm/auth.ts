import type { NcmQrStatus } from '$lib/types'
import type { NcmCallContext } from './types'
/**
 * 网易云账号校验与二维码绑定门面实现。
 *
 * 实现 NcmProvider.checkAuth / loginQrKey / loginQrCreate / loginQrCheck（见 ./types）：
 * 调用 hana-music-api 的账号校验与扫码登录接口，映射为领域形状；
 * 失败统一映射为 NcmError（见 ./errors）。
 *
 * 扫码轮询说明：SDK 的 login_qr_check 编码官方网页轮询端点 /api/login/qrcode/client/login，
 * 无旧端点的时间戳缓存问题，且 SDK 模块固定只传 { key, type }（时间戳字段不会透传出去）；
 * Spec 的「轮询带时间戳防缓存」由轮询调用方（客户端 fetchQrStatus 的时间戳参数）承担，
 * 本门面不重复附加。
 */
import {
  loginQrCheck as sdkLoginQrCheck,
  loginQrCreate as sdkLoginQrCreate,
  loginQrKey as sdkLoginQrKey,
  userAccount as sdkUserAccount,
} from 'hana-music-api'
import { mapNcmError, NcmError } from './errors'
import { asNumber, asRecord, asString, sdkConfig } from './raw'

/** 账号校验结果：绑定账号的 id 与昵称 */
export interface NcmAccountInfo {
  userId: number
  nickname: string
}

/** 二维码状态（上游业务码已映射为 NcmQrStatus；确认态携带凭据） */
export type QrCheckState
  = | { status: Exclude<NcmQrStatus, 'confirmed'> }
    | { status: 'confirmed', cookie?: string }

/**
 * 把 user_account 返回体映射为账号信息（纯函数，便于单测）。
 * 上游字段缺失/类型不符时回落安全空值。
 */
export function mapAccountBody(body: unknown): NcmAccountInfo {
  const record = asRecord(body)
  return {
    userId: asNumber(asRecord(record.account).id),
    nickname: asString(asRecord(record.profile).nickname),
  }
}

/**
 * 把 login_qr_key 返回体映射为二维码 key（纯函数，便于单测）。
 * unikey 即二维码 key；两侧字段同值兜底互取。
 */
export function mapQrKeyBody(body: unknown): { key: string, unikey: string } {
  const unikey = asString(asRecord(asRecord(body).data).unikey)
  return { key: unikey, unikey }
}

/**
 * 把 login_qr_create 返回体映射为二维码内容与图片（纯函数，便于单测）。
 * qrUrl 为二维码内容（扫码落点），qrimg 为上游生成好的二维码图片（data URL，
 * 直接呈现，客户端无需引入二维码渲染库）。
 */
export function mapQrCreateBody(body: unknown): { qrUrl: string, qrimg: string } {
  const data = asRecord(asRecord(body).data)
  return { qrUrl: asString(data.qrurl), qrimg: asString(data.qrimg) }
}

/**
 * 把 login_qr_check 返回体映射为领域状态（纯函数，便于单测）。
 * 确认态携带上游回传的凭据（cookie）；未识别状态返回 null，由调用方按错误处理。
 */
export function mapQrCheckBody(body: unknown): QrCheckState | null {
  const code = asNumber(asRecord(body).code)
  if (code === 800)
    return { status: 'expired' }
  if (code === 801)
    return { status: 'waiting' }
  if (code === 802)
    return { status: 'scanned' }
  if (code === 803) {
    const cookie = asString(asRecord(body).cookie)
    return cookie ? { status: 'confirmed', cookie } : { status: 'confirmed' }
  }
  return null
}

/** 账号校验：失败抛 NcmError，UNAUTHENTICATED 表示绑定失效 */
export async function ncmCheckAuth(ctx: NcmCallContext): Promise<NcmAccountInfo> {
  try {
    const res = await sdkUserAccount({}, sdkConfig(ctx.cookie))
    // 上游偶发「HTTP 200 + 业务失败码」的返回形态，按门面错误模型映射
    const code = asRecord(res.body).code
    if (typeof code === 'number' && code !== 200) {
      throw mapNcmError({ status: res.status, body: res.body })
    }
    const info = mapAccountBody(res.body)
    // 「HTTP 200 + 空 account」形态：无效/匿名凭据的典型应答，按绑定失效处理
    if (info.userId <= 0)
      throw new NcmError('UNAUTHENTICATED', '需要登录', { cause: res.body })
    return info
  }
  catch (err) {
    throw mapNcmError(err)
  }
}

/** 二维码绑定第一步：获取二维码 key；失败抛 NcmError */
export async function ncmLoginQrKey(): Promise<{ key: string, unikey: string }> {
  try {
    const res = await sdkLoginQrKey({})
    return mapQrKeyBody(res.body)
  }
  catch (err) {
    throw mapNcmError(err)
  }
}

/** 二维码绑定第二步：由 key 生成二维码内容与图片；失败抛 NcmError */
export async function ncmLoginQrCreate(key: string): Promise<{ qrUrl: string, qrimg: string }> {
  try {
    const res = await sdkLoginQrCreate({ key, qrimg: true })
    return mapQrCreateBody(res.body)
  }
  catch (err) {
    throw mapNcmError(err)
  }
}

/** 二维码绑定第三步：轮询扫码状态；确认态携带凭据；未识别状态按 UNKNOWN 抛错 */
export async function ncmLoginQrCheck(key: string): Promise<QrCheckState> {
  try {
    const res = await sdkLoginQrCheck({ key })
    const state = mapQrCheckBody(res.body)
    if (!state)
      throw new NcmError('UNKNOWN', '扫码状态检查失败，请重试', { cause: res.body })
    return state
  }
  catch (err) {
    throw mapNcmError(err)
  }
}
