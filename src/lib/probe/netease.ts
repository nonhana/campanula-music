export type Level = 'standard' | 'exhigh' | 'lossless' | 'hires'

export interface AudioUrl {
  id: number
  url: string
  size: number
  type: string
  level: string
}

interface UrlItem {
  id: number
  code: number
  url: string | null
  size: number
  type: string
  level: string
}

/** 经测试版的 /api/call 调网易云：不登录、不带 IP。页面和 Service Worker 都能用。 */
async function callModule<T>(module: string, query: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/call', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ module, query, ip: 'none' }),
  })
  const data = await response.json().catch(() => null) as { code?: number, body?: T & { message?: string, msg?: string }, error?: string } | null
  if (!response.ok || !data)
    throw new Error(`HTTP ${response.status}${data?.error ? ` ${data.error}` : ''}`)
  if (data.code !== 200 || !data.body)
    throw new Error(`网易云 ${data.code} ${data.body?.message ?? data.body?.msg ?? ''}`)
  return data.body
}

/** 网易云给的是 http 地址；HTTPS 页面里要换成 https，音频服务器支持（2026-10-09 实测，也允许跨域和分段请求）。 */
function toAudioUrl(item: UrlItem | undefined): AudioUrl {
  if (!item?.url)
    throw new Error(`歌曲 ${item?.id} 没有地址（code ${item?.code}）`)
  return { id: item.id, url: item.url.replace(/^http:/, 'https:'), size: item.size, type: item.type, level: item.level }
}

export async function playUrl(id: number, level: Level): Promise<AudioUrl> {
  const body = await callModule<{ data?: UrlItem[] }>('song_url_v1', { id, level })
  return toAudioUrl(body.data?.[0])
}

export async function downloadUrl(id: number, level: Level): Promise<AudioUrl> {
  const body = await callModule<{ data?: UrlItem }>('song_download_url_v1', { id, level })
  return toAudioUrl(body.data)
}
