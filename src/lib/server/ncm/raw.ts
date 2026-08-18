/**
 * hana-music-api 返回体 → 领域形状的防御性取值助手。
 *
 * 多个门面实现共用：上游字段缺失/类型不符时一律回落到安全空值，
 * 不做服务端二次补全。由门面内部使用，不对外暴露。
 */

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** 封面地址统一为 https（上游偶发 http 协议，混用会被浏览器拦截） */
export function asImageUrl(value: unknown): string {
  return asString(value).replace(/^http:/, 'https:')
}

/** 绑定凭据 → SDK 调用配置；无凭据时不传 cookie（与既有 search 门面一致的调用约定） */
export function sdkConfig(cookie: string): { cookie: string } | undefined {
  return cookie ? { cookie } : undefined
}
