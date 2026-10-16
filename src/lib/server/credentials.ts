import type { Cookies } from '@sveltejs/kit'
import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto'
import { COOKIE_SECRET } from '$app/env/private'

// 登录 Cookie（ADR-0003）：网易云凭据、deviceId、续期时间用站长配置的密钥加密并签名，
// 交给听众的浏览器保管（httpOnly、Secure）。服务器不存，每次请求解开用完即弃。

/** 登录 Cookie 里的东西 */
export interface LoginCookie {
  /** 为这个听众生成的 deviceId：取二维码、发验证码时就生成，登录后沿用，每次调网易云都带上 */
  deviceId: string
  /** 登录以后才有 */
  session: {
    /** 网易云凭据：只存 Cookie 的名字和值（连属性一起存，加密后约 6.9 KB，浏览器会丢掉，验证关卡①） */
    credentials: Record<string, string>
    /** 上次续期的时间（毫秒）；登录时就是登录的时间 */
    renewedAt: number
  } | null
}

const COOKIE_NAME = 'campanula_login'
/** 浏览器会悄悄丢掉名字加值超过 4096 字节的 Cookie（RFC 6265bis 5.6） */
const MAX_COOKIE_BYTES = 4096
/**
 * 同一浏览器多久续期一次（Spec #11“客户端：登录会话”）。网易云凭据有效 180 天、每次续期重新算，
 * 续期后旧凭据也不会马上失效（验证关卡①），24 小时远短于这些，不用调
 */
const RENEW_INTERVAL_MS = 24 * 3600_000
/** 密钥至少这么长：太短的密钥能被猜出来，拿到 Cookie 的人就能解开凭据 */
export const MIN_SECRET_LENGTH = 32
const OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 400 * 24 * 3600, // Chrome 允许的最长有效期；凭据本身什么时候失效由网易云决定
} as const

/** 站长有没有配好密钥（环境变量 COOKIE_SECRET） */
export function cookieSecretConfigured(): boolean {
  return COOKIE_SECRET.length >= MIN_SECRET_LENGTH
}

/** 加密用的密钥由站长的 COOKIE_SECRET 派生；没配好就明确失败（hooks.server.ts 已经先拦住了接口请求） */
function key(): Buffer {
  const secret = COOKIE_SECRET
  if (!secret || secret.length < MIN_SECRET_LENGTH)
    throw new Error('没有配置 COOKIE_SECRET，不能加密登录 Cookie')
  return Buffer.from(hkdfSync('sha256', secret, '', 'campanula login cookie', 32))
}

/** AES-256-GCM 加密并签名：iv(12) | 密文 | tag(16)，base64url */
function seal(login: LoginCookie): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(login), 'utf8'), cipher.final()])
  return Buffer.concat([iv, data, cipher.getAuthTag()]).toString('base64url')
}

/** 解不开（被改过、换了密钥、格式不对）就当作没有 */
function unseal(value: string): LoginCookie | null {
  const raw = Buffer.from(value, 'base64url')
  if (raw.length < 12 + 16)
    return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(raw.length - 16))
    const text = Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString('utf8')
    return JSON.parse(text) as LoginCookie
  }
  catch {
    return null
  }
}

export function readLogin(cookies: Cookies): LoginCookie | null {
  const value = cookies.get(COOKIE_NAME)
  return value ? unseal(value) : null
}

/** 超过浏览器的上限就报错：浏览器会悄悄丢掉它，不能当作已经存好（验证关卡①的测试版丢过一次凭据） */
function writeLogin(cookies: Cookies, login: LoginCookie): void {
  const value = seal(login)
  const bytes = COOKIE_NAME.length + 1 + value.length
  if (bytes > MAX_COOKIE_BYTES)
    throw new Error(`登录 Cookie 有 ${bytes} 字节，超过浏览器的上限 ${MAX_COOKIE_BYTES}，存不进去`)
  cookies.set(COOKIE_NAME, value, OPTIONS)
}

/** 登录或续期成功：凭据和 deviceId 加密进登录 Cookie，这一刻就是上次续期的时间 */
export function saveLogin(cookies: Cookies, deviceId: string, credentials: Record<string, string>): void {
  writeLogin(cookies, { deviceId, session: { credentials, renewedAt: Date.now() } })
}

/** 离上次续期满 24 小时了 */
export function renewalDue(session: NonNullable<LoginCookie['session']>): boolean {
  return Date.now() - session.renewedAt >= RENEW_INTERVAL_MS
}

/** 回一个过期的登录 Cookie，浏览器收到就删掉它 */
export function clearLogin(cookies: Cookies): void {
  cookies.delete(COOKIE_NAME, OPTIONS)
}

const ID_XOR_KEY = '3go8&$8*3*3h0k(2)2'

/** SDK 匿名注册时 deviceId 的摘要（hana-music-api 的 createAnonymousUsername） */
function anonymousDigest(deviceId: string): string {
  let xored = ''
  for (let index = 0; index < deviceId.length; index += 1)
    xored += String.fromCharCode(deviceId.charCodeAt(index) ^ ID_XOR_KEY.charCodeAt(index % ID_XOR_KEY.length))
  return createHash('md5').update(xored, 'utf8').digest('base64')
}

/**
 * 新的 deviceId：52 位大写十六进制，和 SDK 生成的一样。
 * 摘要里带 + 或 / 的会被网易云的匿名注册拒绝，随机生成约一半中招，所以只要摘要干净的
 * （验证关卡①；nonhana/hana-music-api#30 修好之后可以去掉这一步）
 */
export function newDeviceId(): string {
  let deviceId: string
  do deviceId = randomBytes(26).toString('hex').toUpperCase()
  while (/[+/]/.test(anonymousDigest(deviceId)))
  return deviceId
}

/** 登录前的请求（取二维码、发验证码）用的 deviceId：沿用登录 Cookie 里的；没有就生成一个，存进登录 Cookie */
export function deviceIdFor(cookies: Cookies): string {
  const login = readLogin(cookies)
  if (login)
    return login.deviceId
  const deviceId = newDeviceId()
  writeLogin(cookies, { deviceId, session: null })
  return deviceId
}
