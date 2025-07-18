import type { CookieObject } from '../types/index.js'

export function cookieToJson(cookie: string): CookieObject {
  if (!cookie)
    return {}
  const cookieArr = cookie.split(';')
  const obj: CookieObject = {}
  for (const item of cookieArr) {
    const arr = item.split('=')
    if (arr.length === 2) {
      obj[arr[0].trim()] = arr[1].trim()
    }
  }
  return obj
}
