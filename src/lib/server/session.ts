import type { Cookies } from '@sveltejs/kit'
import type { CookieMeta } from './netease'
import { Buffer } from 'node:buffer'
import { createHash, randomBytes } from 'node:crypto'
import { fingerprint, passToken, sameSecret, seal, unseal } from './seal'

/**
 * 两种登录方式各占一个槽，续期时把旧凭据挪到 `_prev` 槽，
 * 用来测“续期后旧 Cookie 是否马上失效”。所有槽都是加密的 httpOnly Cookie，服务器不存。
 */
export const SLOTS = ['sms', 'qr', 'sms_prev', 'qr_prev'] as const
export type Slot = typeof SLOTS[number]
export type LoginMethod = 'sms' | 'qr'

export interface NeSession {
  method: LoginMethod
  cookie: Record<string, string>
  deviceId: string
  loginAt: number
  refreshedAt?: number
  /** 建立或最近一次续期时网易云给的 Set-Cookie，只有名字和属性，没有值。 */
  setCookie: CookieMeta[]
  fp: string
}

export interface SlotView extends Omit<NeSession, 'cookie'> {
  slot: Slot
  cookieNames: string[]
}

const MAX_AGE = 400 * 24 * 3600
const options = { path: '/', httpOnly: true, secure: true, sameSite: 'strict', maxAge: MAX_AGE } as const

const cookieName = (slot: Slot) => `ne_${slot}`

export function isSlot(value: unknown): value is Slot {
  return typeof value === 'string' && (SLOTS as readonly string[]).includes(value)
}

export function readSlot(cookies: Cookies, slot: Slot): NeSession | null {
  return unseal<NeSession>(cookies.get(cookieName(slot)))
}

export function writeSlot(cookies: Cookies, slot: Slot, session: NeSession): void {
  cookies.set(cookieName(slot), seal(session), options)
}

export function clearSlot(cookies: Cookies, slot: Slot): void {
  cookies.delete(cookieName(slot), { path: '/' })
}

export function viewSlot(slot: Slot, session: NeSession): SlotView {
  const { cookie, ...rest } = session
  return { ...rest, slot, cookieNames: Object.keys(cookie).sort() }
}

export function sessionFrom(method: LoginMethod, cookie: Record<string, string>, deviceId: string, setCookie: CookieMeta[]): NeSession {
  return { method, cookie, deviceId, loginAt: Date.now(), setCookie, fp: fingerprint(cookie.MUSIC_U ?? '') }
}

const ID_XOR_KEY = '3go8&$8*3*3h0k(2)2'

/** SDK 匿名注册时用的 deviceId 摘要（与 hana-music-api 1.4.0 的 createAnonymousUsername 相同）。 */
function anonymousDigest(deviceId: string): string {
  let xored = ''
  for (let index = 0; index < deviceId.length; index += 1)
    xored += String.fromCharCode(deviceId.charCodeAt(index) ^ ID_XOR_KEY.charCodeAt(index % ID_XOR_KEY.length))
  return createHash('md5').update(Buffer.from(xored, 'utf8')).digest('base64')
}

/**
 * 每个浏览器一个 deviceId（52 位大写十六进制，和 SDK 生成的格式一致），登录前后都用同一个。
 * 实测（2026-10-08）：摘要里带 `+` 或 `/` 的 deviceId，网易云匿名注册一律回 400，
 * 随机生成约一半中招，所以这里只要摘要干净的。
 */
export function deviceIdOf(cookies: Cookies): string {
  const existing = cookies.get('gate_dev')
  if (existing && /^[0-9A-F]{52}$/.test(existing))
    return existing
  let created: string
  do created = randomBytes(26).toString('hex').toUpperCase()
  while (/[+/]/.test(anonymousDigest(created)))
  cookies.set('gate_dev', created, options)
  return created
}

export function hasPass(cookies: Cookies): boolean {
  const value = cookies.get('gate_pass')
  return value !== undefined && sameSecret(value, passToken())
}

export function grantPass(cookies: Cookies): void {
  cookies.set('gate_pass', passToken(), { ...options, maxAge: 30 * 24 * 3600 })
}
