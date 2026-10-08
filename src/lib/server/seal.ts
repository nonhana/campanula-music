import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from '$env/dynamic/private'

function key(purpose: string): Buffer {
  const secret = env.GATE_SECRET
  if (!secret)
    throw new Error('GATE_SECRET 未配置')
  return createHash('sha256').update(`${purpose}:${secret}`).digest()
}

/** AES-256-GCM 加密并签名，输出 base64url：iv(12) | 密文 | tag(16)。 */
export function seal(value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key('seal'), iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, data, cipher.getAuthTag()]).toString('base64url')
}

/** 解不开（被改过、换了密钥、格式不对）一律当作没有。 */
export function unseal<T>(token: string | undefined): T | null {
  if (!token)
    return null
  try {
    const raw = Buffer.from(token, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key('seal'), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(raw.length - 16))
    const text = Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString('utf8')
    return JSON.parse(text) as T
  }
  catch {
    return null
  }
}

/** 口令 Cookie 的值：口令的 HMAC，不存口令本身；换口令或换密钥后旧 Cookie 自动作废。 */
export function passToken(): string {
  const passcode = env.GATE_PASSCODE
  if (!passcode)
    throw new Error('GATE_PASSCODE 未配置')
  return createHmac('sha256', key('pass')).update(passcode).digest('base64url')
}

export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** 只用来比较两份 MUSIC_U 是否相同，8 位十六进制，推不回原值。 */
export function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8)
}
