import { error } from '@sveltejs/kit'

/** 中国大陆手机号（+86）：1 开头的 11 位数字 */
export const PHONE = /^1\d{10}$/
/** 短信验证码：4 到 6 位数字 */
export const CAPTCHA = /^\d{4,6}$/
/** 二维码的 key（网易云给的 UUID） */
export const QR_KEY = /^[\w-]{1,64}$/

/**
 * 读请求体（JSON）里的字符串字段，每个都要符合格式，否则回 400。
 * 界面发请求前已经检查过格式，到这里还不对，说明请求不是 Campanula 的页面发的
 */
export async function readFields<K extends string>(request: Request, patterns: Record<K, RegExp>): Promise<Record<K, string>> {
  const body: unknown = await request.json().catch(() => null)
  const fields = {} as Record<K, string>
  for (const name of Object.keys(patterns) as K[]) {
    const value = typeof body === 'object' && body !== null && name in body ? (body as Record<K, unknown>)[name] : undefined
    if (typeof value !== 'string' || !patterns[name].test(value))
      error(400, `${name} 的格式不对`)
    fields[name] = value
  }
  return fields
}
