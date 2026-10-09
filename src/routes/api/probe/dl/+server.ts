import type { RequestHandler } from './$types'
import { callNetease } from '$lib/server/netease'
import { deviceIdOf } from '$lib/server/session'
import { error, redirect } from '@sveltejs/kit'

const LEVELS = new Set(['standard', 'exhigh', 'lossless', 'hires'])

/**
 * 验证关卡③：后台下载“经服务器跳转”。Background Fetch 的每个请求先到这里，
 * 服务器在请求到达时才取下载地址，再 302 跳到网易云的音频服务器。
 * 这样一批里排在后面的歌，开始下载时拿到的也是新地址（地址约 20 分钟过期）。
 * 能走到这里，也说明后台下载的请求带上了口令 Cookie（hooks 里会检查）。
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
  const id = Number(url.searchParams.get('id'))
  const level = url.searchParams.get('level') ?? ''
  if (!Number.isSafeInteger(id) || id <= 0 || !LEVELS.has(level))
    error(400, 'id 或 level 不对')
  const { result, code } = await callNetease({
    module: 'song_download_url_v1',
    query: { id, level },
    ip: 'none',
    deviceId: deviceIdOf(cookies),
    summary: false,
  })
  const target = 'body' in result ? (result.body as { data?: { url?: unknown } } | undefined)?.data?.url : undefined
  if (code !== 200 || typeof target !== 'string')
    error(502, `网易云 ${code}`)
  // 只跳到网易云的音频服务器（m7.music.126.net、m801.music.126.net 这类），不做通用跳转
  const location = new URL(target.replace(/^http:/, 'https:'))
  if (!location.hostname.endsWith('.music.126.net'))
    error(502, `下载地址不在网易云音频服务器上：${location.hostname}`)
  redirect(302, location.href)
}
