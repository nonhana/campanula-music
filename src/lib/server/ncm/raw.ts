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

/** 网易云图片 CDN 主机池：p1–p4 同源同物（路径含对象密钥，跨主机一致），仅主机名可互换 */
const IMAGE_CDN_HOSTS = ['p1.music.126.net', 'p2.music.126.net', 'p3.music.126.net', 'p4.music.126.net'] as const

/** FNV-1a 32 位哈希：对路径做稳定分片，跨重启/实例结果一致（零状态缓存） */
function hashShard(text: string): number {
  let hash = 0x811C9DC5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** 资源地址统一为 https（上游偶发 http 协议，混用会被浏览器拦截） */
export function asHttpUrl(value: unknown): string {
  return asString(value).replace(/^http:/, 'https:')
}

/**
 * 图片地址统一为 https，并对网易云 CDN 地址做确定性主机归一。
 *
 * 上游同一张图（路径相同）会在 p1–p4 间随机漂移，浏览器缓存按完整 URL 命中，
 * 漂移即重复下载；路径哈希分片让同一路径永远落在同一主机，图片只下载一次，
 * 同时路径仍摊在 4 个主机上，不产生单点热点。非网易云地址原样返回。
 */
export function asImageUrl(value: unknown): string {
  const url = asHttpUrl(value)
  if (!url)
    return url
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.endsWith('.music.126.net'))
      return url
    parsed.hostname = IMAGE_CDN_HOSTS[hashShard(parsed.pathname) % IMAGE_CDN_HOSTS.length]
    return parsed.toString()
  }
  catch {
    return url
  }
}

/** 单次批量请求的 id 数上限（网易云对单请求 id 数有上限，分片防截断；红心补全、播放地址与歌单曲目分页上限共用） */
export const TRACK_CHUNK_SIZE = 1000

/** 把 id 列表按单请求上限分片 */
export function chunkIds(ids: number[], size: number): number[][] {
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += size)
    chunks.push(ids.slice(i, i + size))
  return chunks
}

/** 绑定凭据 → SDK 调用配置；无凭据时不传 cookie（与既有 search 门面一致的调用约定） */
export function sdkConfig(cookie: string): { cookie: string } | undefined {
  return cookie ? { cookie } : undefined
}
